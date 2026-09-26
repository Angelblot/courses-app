import Foundation
import Darwin

struct TableeMissing: Codable {
  let id: String
  let name: String
  let quantity: Int
  let source: String
  let createdAt: String
  var productID: String? = nil
}
struct TableeProduct: Codable, Identifiable {
  let id: String
  let name: String
  let detail: String
  let imageURL: String?
  var imageFile: String? = nil
  var inList: Bool
}
struct TableeData: Codable {
  var account: String? = nil
  var pending: [TableeMissing] = []
  // Optional fields keep inboxes written by build 29 readable.
  var products: [TableeProduct]? = nil
  var widgetAdded: [String: String]? = nil
  var widgetPage: Int? = nil
  var pageChangedAt: Date? = nil

  func isAdded(_ id: String) -> Bool {
    products?.first(where: { $0.id == id })?.inList == true || widgetAdded?[id] != nil || pending.contains { $0.productID == id }
  }
  mutating func addProduct(_ id: String, account expected: String) throws {
    guard account == expected, let product = products?.first(where: { $0.id == id }) else {
      throw NSError(domain: "Tablee", code: 2, userInfo: [NSLocalizedDescriptionKey: "Ouvre Courses pour actualiser tes produits."])
    }
    guard !isAdded(id) else { return }
    let item = TableeMissing(id: UUID().uuidString, name: String(product.name.prefix(120)), quantity: 1,
      source: "widget", createdAt: ISO8601DateFormatter().string(from: Date()), productID: id)
    pending.append(item)
    var added = widgetAdded ?? [:]; added[id] = item.id; widgetAdded = added
  }
  mutating func syncProducts(_ values: [TableeProduct], imported: [String]) {
    products = values
    if pageChangedAt == nil { pageChangedAt = .now }
    let done = Set(imported)
    widgetAdded = (widgetAdded ?? [:]).filter { !done.contains($0.value) }
  }
}
enum TableeStore {
  static let group = "group.com.coursesapp.mobile"
  static func access<T>(_ body: (inout TableeData) throws -> T) throws -> T {
    guard let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else {
      throw NSError(domain: "Tablee", code: 1, userInfo: [NSLocalizedDescriptionKey: "Ouvre Courses sur ton iPhone pour activer les ajouts Siri."])
    }
    let fd = open(root.appendingPathComponent("inbox.lock").path, O_CREAT | O_RDWR, 0o600)
    guard fd >= 0 else { throw CocoaError(.fileWriteUnknown) }
    defer { close(fd) }
    guard flock(fd, LOCK_EX) == 0 else { throw CocoaError(.fileWriteUnknown) }
    defer { flock(fd, LOCK_UN) }
    let file = root.appendingPathComponent("inbox.json")
    var state: TableeData
    if FileManager.default.fileExists(atPath: file.path) {
      state = try JSONDecoder().decode(TableeData.self, from: Data(contentsOf: file))
    } else { state = TableeData() }
    let result = try body(&state)
    try JSONEncoder().encode(state).write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    return result
  }
  static func session(_ account: String?) throws {
    try access { data in
      // Preserve each account's pending additions through logout/account switching.
      if data.account != account {
        let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)!
        if let old = data.account, UUID(uuidString: old) != nil {
          try JSONEncoder().encode(data.pending).write(to: root.appendingPathComponent("pending-\(old).json"), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
        var pending: [TableeMissing] = []
        if let account {
          guard UUID(uuidString: account) != nil else { throw CocoaError(.validationMissingMandatoryProperty) }
          let file = root.appendingPathComponent("pending-\(account).json")
          if FileManager.default.fileExists(atPath: file.path) { pending = try JSONDecoder().decode([TableeMissing].self, from: Data(contentsOf: file)) }
        }
        data = TableeData(account: account, pending: pending)
      }
    }
  }
}
