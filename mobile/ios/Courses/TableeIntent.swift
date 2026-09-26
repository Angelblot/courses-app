import AppIntents
import WidgetKit

struct AjouterManquantIntent: AppIntent {
  static var title: LocalizedStringResource = "Noter un produit manquant"
  static var description = IntentDescription("Ajoute un manque à ta liste de courses après confirmation.")
  static var openAppWhenRun = false
  static var authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication
  @Parameter(title: "Produit", requestValueDialog: "Quel produit te manque ?") var produit: String
  @Parameter(title: "Quantité", default: 1) var quantite: Int
  static var parameterSummary: some ParameterSummary { Summary("Ajouter \(\.$quantite) × \(\.$produit)") }
  func perform() async throws -> some IntentResult & ProvidesDialog {
    let name = produit.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !name.isEmpty, name.count <= 120 else { throw $produit.needsValueError("Quel produit souhaites-tu ajouter ?") }
    guard (1...99).contains(quantite) else { throw $quantite.needsValueError("Choisis une quantité entre 1 et 99.") }
    let account = try TableeStore.access { $0.account }
    guard let account else { return .result(dialog: "Connecte-toi d’abord dans Courses sur ton iPhone.") }
    // iOS 16 compatibility; confirmation precedes every persistent mutation.
    try await requestConfirmation(result: .result(dialog: "Ajouter \(quantite) fois \(name) à ta liste de courses ?"))
    try TableeStore.access { data in
      guard data.account == account else { throw NSError(domain: "Tablee", code: 2, userInfo: [NSLocalizedDescriptionKey: "Le compte a changé. Ouvre Courses et réessaie."]) }
      data.pending.append(TableeMissing(id: UUID().uuidString, name: name, quantity: quantite, source: "siri", createdAt: ISO8601DateFormatter().string(from: Date())))
    }
    WidgetCenter.shared.reloadAllTimelines()
    return .result(dialog: "\(quantite) fois \(name) enregistré. Tu le retrouveras dans ta liste à l’ouverture de Courses.")
  }
}
struct TableeShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(intent: AjouterManquantIntent(), phrases: ["Note un manque dans \(.applicationName)", "Ajoute un produit dans \(.applicationName)"], shortTitle: "Noter un manque", systemImageName: "cart.badge.plus")
  }
}
