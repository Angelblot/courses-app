import Foundation
let old = Data(#"{"account":"a","pending":[{"id":"siri-old","name":"Lait","quantity":2,"source":"siri","createdAt":"2026-09-12"}]}"#.utf8)
var state = try JSONDecoder().decode(TableeData.self, from: old)
assert(state.pending.count == 1 && state.products == nil)
let product = TableeProduct(id:"milk", name:"Lait", detail:"1 L", imageURL:nil, inList:false)
state.syncProducts([product], imported:[])
try state.addProduct("milk", account:"a")
try state.addProduct("milk", account:"a")
assert(state.pending.count == 2 && state.pending.last?.productID == "milk")
let receipt = state.pending.last!.id
state.pending.removeAll { $0.id == receipt }
state.syncProducts([product], imported:[]) // stale app snapshot must preserve the added checkmark
assert(state.isAdded("milk"))
var selected = product; selected.inList = true
state.syncProducts([selected], imported:[receipt]); assert(state.isAdded("milk"))
state.syncProducts([product], imported:[receipt]); assert(!state.isAdded("milk"))
do { try state.addProduct("milk", account:"other"); fatalError("Wrong account accepted") } catch {}
let roundTrip = try JSONDecoder().decode(TableeData.self, from: JSONEncoder().encode(state))
assert(roundTrip.pending.first?.id == "siri-old")
print("PASS: legacy Siri inbox, product ID, double tap, stale snapshot, removal, account guard, persistence")
