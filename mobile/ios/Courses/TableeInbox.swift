import Foundation
import React
import WidgetKit
import UIKit
import CryptoKit

@objc(TableeInbox)
class TableeInbox: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }
  @objc func setSession(_ account: String?, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do { try TableeStore.session(account); WidgetCenter.shared.reloadAllTimelines(); resolve(true) }
    catch { reject("INBOX_SESSION", error.localizedDescription, error) }
  }
  private var imageTask: Task<Void, Never>?
  private struct Snapshot: Decodable { let products: [TableeProduct]; let imported: [String] }
  @objc func syncProducts(_ account: String, json: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do {
      let snapshot = try JSONDecoder().decode(Snapshot.self, from: Data(json.utf8))
      guard let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: TableeStore.group) else { throw CocoaError(.fileNoSuchFile) }
      let directory = root.appendingPathComponent("product-images", isDirectory: true)
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      let products = snapshot.products.map { item -> TableeProduct in
        var p = item
        if let url = p.imageURL {
          p.imageFile = SHA256.hash(data: Data("\(account):\(p.id):\(url)".utf8)).map { String(format: "%02x", $0) }.joined() + ".png"
        }
        return p
      }
      try TableeStore.access { data in
        guard data.account == account else { throw CocoaError(.userCancelled) }
        data.syncProducts(products, imported: snapshot.imported)
      }
      WidgetCenter.shared.reloadTimelines(ofKind: "TableeMissing")
      resolve(true)
      imageTask?.cancel()
      imageTask = Task {
        // Download outside the file lock; each image is small enough for WidgetKit's memory budget.
        for product in products {
          if Task.isCancelled { return }
          guard let name = product.imageFile, let raw = product.imageURL, let url = URL(string: raw) else { continue }
          let file = directory.appendingPathComponent(name)
          if FileManager.default.fileExists(atPath: file.path) { continue }
          do {
            let bytes: Data
            if url.isFileURL { bytes = try Data(contentsOf: url) }
            else {
              guard url.scheme == "https" || (url.scheme == "http" && ["localhost", "127.0.0.1"].contains(url.host ?? "")) else { continue }
              let (data, response) = try await URLSession.shared.data(for: URLRequest(url: url, timeoutInterval: 8))
              guard (response as? HTTPURLResponse)?.statusCode == 200, data.count < 5_000_000 else { continue }
              bytes = data
            }
            guard !Task.isCancelled, let image = UIImage(data: bytes), image.size.width > 0, image.size.height > 0 else { continue }
            let ratio = min(224 / image.size.width, 224 / image.size.height, 1)
            let size = CGSize(width: image.size.width * ratio, height: image.size.height * ratio)
            let format = UIGraphicsImageRendererFormat(); format.scale = 1
            let thumb = UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
            if let png = thumb.pngData() { try png.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication]) }
          } catch { continue }
        }
        if !Task.isCancelled { WidgetCenter.shared.reloadTimelines(ofKind: "TableeMissing") }
      }
    } catch { reject("WIDGET_SYNC", error.localizedDescription, error) }
  }
  @objc func read(_ account: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do {
      let items = try TableeStore.access { data -> [TableeMissing] in data.account == account ? data.pending : [] }
      resolve(try JSONSerialization.jsonObject(with: JSONEncoder().encode(items)))
    } catch { reject("INBOX_READ", error.localizedDescription, error) }
  }
  @objc func acknowledge(_ account: String, ids: [String], resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do {
      try TableeStore.access { data in if data.account == account { let done = Set(ids); data.pending.removeAll { done.contains($0.id) } } }
      WidgetCenter.shared.reloadAllTimelines(); resolve(true)
    } catch { reject("INBOX_ACK", error.localizedDescription, error) }
  }
}
