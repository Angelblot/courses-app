import Foundation
import React
import WidgetKit
import UIKit
import CryptoKit
import EventKit

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
      // Siri apprend les noms et phrases des produits : « Ajoute crème fraîche dans Courses ».
      TableeShortcuts.updateAppShortcutParameters()
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


/// Reprend une liste Rappels : Siri y range « ajoute … à ma liste de courses ».
/// Lecture des articles non cochés, puis on les coche une fois enregistrés dans l'app.
@objc(TableeRappels)
class TableeRappels: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }
  private let store = EKEventStore()

  private func autorise() -> Bool {
    let statut = EKEventStore.authorizationStatus(for: .reminder)
    if #available(iOS 17.0, *) { return statut == .fullAccess }
    return statut == .authorized
  }
  @objc func statut(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    switch EKEventStore.authorizationStatus(for: .reminder) {
    case .notDetermined: resolve("indetermine")
    case .denied, .restricted: resolve("refuse")
    default: resolve(autorise() ? "autorise" : "refuse")
    }
  }
  @objc func demander(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let fin: (Bool, Error?) -> Void = { ok, erreur in
      if let erreur { reject("RAPPELS_ACCES", erreur.localizedDescription, erreur) } else { resolve(ok) }
    }
    if #available(iOS 17.0, *) { store.requestFullAccessToReminders(completion: fin) }
    else { store.requestAccess(to: .reminder, completion: fin) }
  }
  private func nonCoches(_ listes: [EKCalendar]) async -> [EKReminder] {
    let predicat = store.predicateForIncompleteReminders(withDueDateStarting: nil, ending: nil, calendars: listes)
    return await withCheckedContinuation { suite in store.fetchReminders(matching: predicat) { suite.resume(returning: $0 ?? []) } }
  }
  @objc func listes(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard autorise() else { return reject("RAPPELS_ACCES", "Accès aux Rappels refusé.", nil) }
    Task {
      var sortie: [[String: Any]] = []
      for liste in store.calendars(for: .reminder) {
        let n = await nonCoches([liste]).count
        let c = UIColor(cgColor: liste.cgColor)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        c.getRed(&r, green: &g, blue: &b, alpha: &a)
        sortie.append(["id": liste.calendarIdentifier, "titre": liste.title, "nombre": n,
          "couleur": String(format: "#%02X%02X%02X", Int(r * 255), Int(g * 255), Int(b * 255))])
      }
      resolve(sortie)
    }
  }
  @objc func lire(_ id: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard autorise() else { return reject("RAPPELS_ACCES", "Accès aux Rappels refusé.", nil) }
    guard let liste = store.calendar(withIdentifier: id) else { return resolve(NSNull()) }
    Task {
      let articles = await nonCoches([liste]).prefix(60).map { ["id": $0.calendarItemIdentifier, "titre": $0.title ?? ""] }
      resolve(["titre": liste.title, "articles": articles])
    }
  }
  @objc func cocher(_ ids: [String], fait: Bool, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    guard autorise() else { return reject("RAPPELS_ACCES", "Accès aux Rappels refusé.", nil) }
    do {
      for id in ids {
        guard let rappel = store.calendarItem(withIdentifier: id) as? EKReminder, rappel.isCompleted != fait else { continue }
        rappel.isCompleted = fait
        try store.save(rappel, commit: false)
      }
      try store.commit()
      resolve(true)
    } catch { reject("RAPPELS_COCHER", error.localizedDescription, error) }
  }
}
