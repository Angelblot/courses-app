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
/// Un produit de « Mes produits », que Siri reconnaît dans la phrase même.
struct ProduitEntity: AppEntity {
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Produit"
  static var defaultQuery = ProduitQuery()
  let id: String
  let nom: String
  let synonymes: [String]
  var displayRepresentation: DisplayRepresentation {
    // Les synonymes (phrases retenues, type de produit) arrivent avec iOS 17.
    if #available(iOS 17.0, *) { return DisplayRepresentation(title: "\(nom)", synonyms: synonymes.map { "\($0)" }) }
    return DisplayRepresentation(title: "\(nom)")
  }
  init(_ p: TableeProduct) { id = p.id; nom = p.name; synonymes = p.synonyms ?? [] }
}
struct ProduitQuery: EntityStringQuery {
  private func tous() -> [ProduitEntity] { ((try? TableeStore.access { $0.products }) ?? nil)?.map(ProduitEntity.init) ?? [] }
  func entities(for identifiers: [String]) async throws -> [ProduitEntity] { tous().filter { identifiers.contains($0.id) } }
  func suggestedEntities() async throws -> [ProduitEntity] { tous() }
  func entities(matching texte: String) async throws -> [ProduitEntity] {
    let cherche = texte.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
    return tous().filter { p in ([p.nom] + p.synonymes).contains { $0.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current).contains(cherche) } }
  }
}

struct AjouterProduitIntent: AppIntent {
  static var title: LocalizedStringResource = "Ajouter un de mes produits"
  static var description = IntentDescription("Ajoute un produit de « Mes produits » à ta liste de courses.")
  static var openAppWhenRun = false
  static var authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication
  @Parameter(title: "Produit", requestValueDialog: "Quel produit te manque ?") var produit: ProduitEntity
  @Parameter(title: "Quantité", default: 1) var quantite: Int
  static var parameterSummary: some ParameterSummary { Summary("Ajouter \(\.$quantite) × \(\.$produit)") }
  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard (1...99).contains(quantite) else { throw $quantite.needsValueError("Choisis une quantité entre 1 et 99.") }
    let account = try TableeStore.access { $0.account }
    guard let account else { return .result(dialog: "Connecte-toi d’abord dans Courses sur ton iPhone.") }
    let nom = produit.nom, id = produit.id, n = quantite
    try TableeStore.access { data in
      guard data.account == account else { throw NSError(domain: "Tablee", code: 2, userInfo: [NSLocalizedDescriptionKey: "Le compte a changé. Ouvre Courses et réessaie."]) }
      data.pending.append(TableeMissing(id: UUID().uuidString, name: String(nom.prefix(120)), quantity: n, source: "siri", createdAt: ISO8601DateFormatter().string(from: Date()), productID: id))
    }
    WidgetCenter.shared.reloadAllTimelines()
    return .result(dialog: "\(nom) ajouté à ta liste de courses.")
  }
}

struct TableeShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(intent: AjouterProduitIntent(), phrases: ["Ajoute \(\.$produit) dans \(.applicationName)", "Note \(\.$produit) dans \(.applicationName)", "Il manque \(\.$produit) dans \(.applicationName)"], shortTitle: "Ajouter un produit", systemImageName: "cart.badge.plus")
    AppShortcut(intent: AjouterManquantIntent(), phrases: ["Note un manque dans \(.applicationName)", "Ajoute un produit dans \(.applicationName)"], shortTitle: "Noter un manque", systemImageName: "square.and.pencil")
  }
}
