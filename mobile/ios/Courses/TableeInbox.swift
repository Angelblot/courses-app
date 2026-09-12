import Foundation
import React
import WidgetKit

@objc(TableeInbox)
class TableeInbox: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }
  @objc func setSession(_ account: String?, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do { try TableeStore.session(account); WidgetCenter.shared.reloadAllTimelines(); resolve(true) }
    catch { reject("INBOX_SESSION", error.localizedDescription, error) }
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
