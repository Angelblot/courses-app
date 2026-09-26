import WidgetKit
import SwiftUI
import AppIntents

private let olive = Color(red: 0.282, green: 0.38, blue: 0.227)

struct AddEssentialIntent: AppIntent {
  static var title: LocalizedStringResource = "Ajouter un essentiel"
  static var openAppWhenRun = false
  static var isDiscoverable = false
  static var authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication
  @Parameter(title: "Compte") var account: String
  @Parameter(title: "Produit") var productID: String
  init() {}
  init(account: String, productID: String) { self.account = account; self.productID = productID }
  func perform() async throws -> some IntentResult {
    try TableeStore.access { try $0.addProduct(productID, account: account) }
    WidgetCenter.shared.reloadTimelines(ofKind: "TableeMissing")
    return .result()
  }
}
struct NextEssentialsIntent: AppIntent {
  static var title: LocalizedStringResource = "Voir les essentiels suivants"
  static var openAppWhenRun = false
  static var isDiscoverable = false
  static var authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication
  @Parameter(title: "Compte") var account: String
  @Parameter(title: "Page") var page: Int
  init() {}
  init(account: String, page: Int) { self.account = account; self.page = page }
  func perform() async throws -> some IntentResult {
    try TableeStore.access { data in
      guard data.account == account else { throw CocoaError(.userCancelled) }
      data.widgetPage = max(0, page); data.pageChangedAt = .now
    }
    WidgetCenter.shared.reloadTimelines(ofKind: "TableeMissing")
    return .result()
  }
}
struct MissingEntry: TimelineEntry {
  let date: Date
  let account: String?
  let products: [TableeProduct]
  let added: Set<String>
  let page: Int
  let pages: Int
  let hasCatalogue: Bool
  var allAdded: Bool = false
}
struct MissingProvider: TimelineProvider {
  func placeholder(in context: Context) -> MissingEntry {
    MissingEntry(date: .now, account: nil, products: [], added: [], page: 0, pages: 1, hasCatalogue: false)
  }
  static func capacity(_ family: WidgetFamily) -> Int {
    switch family { case .systemLarge, .systemExtraLarge: return 6; case .systemMedium: return 3; default: return 1 }
  }
  func entry(family: WidgetFamily, date: Date = .now) -> MissingEntry {
    let data = (try? TableeStore.access { $0 }) ?? TableeData()
    let all = (data.products ?? []).filter { !$0.inList || data.widgetAdded?[$0.id] != nil }
    let count = Self.capacity(family)
    let pages = max(1, Int(ceil(Double(all.count) / Double(count))))
    // Timelines, not animation: iPadOS decides when the next refresh can run.
    let elapsed = max(0, Int(date.timeIntervalSince(data.pageChangedAt ?? date) / 1800))
    let page = ((data.widgetPage ?? 0) + elapsed) % pages
    let selected = Array(all.dropFirst(page * count).prefix(count))
    return MissingEntry(date: date, account: data.account, products: selected,
      added: Set(all.filter { data.isAdded($0.id) }.map(\.id)), page: page, pages: pages, hasCatalogue: data.products != nil, allAdded: !(data.products ?? []).isEmpty && all.isEmpty)
  }
  func getSnapshot(in context: Context, completion: @escaping (MissingEntry) -> Void) { completion(entry(family: context.family)) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<MissingEntry>) -> Void) {
    let now = Date()
    completion(Timeline(entries: [entry(family: context.family, date: now), entry(family: context.family, date: now.addingTimeInterval(1800))],
      policy: .after(now.addingTimeInterval(3600))))
  }
}
struct MissingView: View {
  let entry: MissingEntry
  @Environment(\.widgetFamily) var family
  @Environment(\.colorScheme) var scheme
  @Environment(\.dynamicTypeSize) var typeSize
  private var compact: Bool { family == .systemSmall || family == .systemMedium }
  private var ink: Color { scheme == .dark ? Color(red: 0.88, green: 0.93, blue: 0.83) : Color(red: 0.12, green: 0.18, blue: 0.10) }
  private var paper: Color { scheme == .dark ? Color(red: 0.10, green: 0.14, blue: 0.09) : Color(red: 0.945, green: 0.957, blue: 0.917) }
  private var card: Color { scheme == .dark ? Color(red: 0.17, green: 0.21, blue: 0.14) : .white }
  var body: some View {
    Group {
      if family == .accessoryCircular {
        Image(systemName: "cart.badge.plus").widgetURL(URL(string: "coursesapp://ajout"))
      } else if entry.account == nil || entry.products.isEmpty {
        VStack(alignment: .leading, spacing: 10) {
          Label("Tablée Maison", systemImage: "leaf").font(.caption)
          Text(entry.account == nil ? "Tes essentiels, ici." : entry.allAdded ? "Tout est déjà noté." : "Tes habitudes, à portée de main.").font(.headline)
          Text(entry.account == nil ? "Ouvre Courses pour te connecter." : entry.allAdded ? "Tes essentiels sont dans ta liste de courses." : entry.hasCatalogue ? "Ajoute tes produits favoris dans Mes habitudes." : "Ouvre Courses pour retrouver tes produits.").font(.caption)
          Spacer(minLength: 0)
          Link(destination: URL(string: entry.allAdded ? "coursesapp://liste" : "coursesapp://habitudes")!) {
            Label(entry.allAdded ? "Voir ma liste" : "Ouvrir Courses", systemImage: "arrow.up.right").font(.caption.bold()).frame(minHeight: 44)
          }
        }
      } else {
        VStack(alignment: .leading, spacing: compact ? 6 : 10) {
          if family != .systemSmall { HStack {
            Text(compact ? "Les essentiels" : "À ajouter cette semaine").font(compact ? .caption.bold() : .headline).lineLimit(1).minimumScaleFactor(0.85)
            Spacer(minLength: 0)
            if !compact { Image(systemName: "leaf").accessibilityLabel("Tablée Maison") }
          } }
          if compact {
            HStack(spacing: 8) { ForEach(entry.products) { tile($0) } }.frame(maxHeight: .infinity)
          } else {
            // Fixed rows fit WidgetKit's non-scrolling canvas, including extra-large iPad widgets.
            VStack(spacing: 8) {
              HStack(spacing: 8) { ForEach(Array(entry.products.prefix(3))) { tile($0) } }
              if entry.products.count > 3 { HStack(spacing: 8) { ForEach(Array(entry.products.dropFirst(3))) { tile($0) } } }
            }.frame(maxHeight: .infinity)
          }
          if entry.pages > 1 {
            HStack {
              if family != .systemSmall { Text("\(entry.page + 1) / \(entry.pages)").font(.caption).monospacedDigit(); Spacer() }
              Button(intent: NextEssentialsIntent(account: entry.account!, page: (entry.page + 1) % entry.pages)) {
                Label("Suivants", systemImage: "arrow.right").font(.caption.bold()).frame(minHeight: 44)
              }.buttonStyle(.plain).accessibilityLabel("Afficher les produits suivants, page \(entry.page + 1) sur \(entry.pages)")
            }
          }
        }
      }
    // A widget cannot scroll or grow. Keep the fixed canvas usable at accessibility sizes;
    // VoiceOver still reads each complete product label, and the full app scales freely.
    }.dynamicTypeSize(...DynamicTypeSize.xxLarge)
      .foregroundStyle(ink).containerBackground(paper, for: .widget)
  }
  @ViewBuilder private func photo(_ product: TableeProduct) -> some View {
    if let file = product.imageFile,
       let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: TableeStore.group),
       let image = UIImage(contentsOfFile: root.appendingPathComponent("product-images").appendingPathComponent(file).path) {
      Image(uiImage: image).resizable().scaledToFit().accessibilityHidden(true)
    } else {
      Image(systemName: "basket").resizable().scaledToFit().padding(8).foregroundStyle(olive).accessibilityHidden(true)
    }
  }
  @ViewBuilder private func tile(_ product: TableeProduct) -> some View {
    let added = entry.added.contains(product.id)
    if added {
      tileContent(product, added: true).accessibilityElement(children: .ignore)
        .accessibilityLabel("\(product.name), ajouté à la liste")
    } else {
      Button(intent: AddEssentialIntent(account: entry.account ?? "", productID: product.id)) {
        tileContent(product, added: false)
      }.buttonStyle(.plain)
        .accessibilityLabel("Ajouter un article : \(product.name), \(product.detail)")
        .accessibilityHint("Enregistre le produit sans ouvrir Courses")
    }
  }
  private func labels(_ product: TableeProduct, added: Bool) -> some View {
    VStack(spacing: compact ? 2 : 4) {
      Text(product.name).font(.caption.weight(.semibold)).lineLimit(compact || typeSize.isAccessibilitySize ? 1 : 2)
        .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
      if !compact { Text(product.detail).font(.caption2).lineLimit(1) }
      HStack(spacing: 3) {
        Image(systemName: added ? "checkmark" : "plus")
        if added && !compact { Text("Ajouté").lineLimit(1) }
      }.font(.caption.bold()).foregroundStyle(added ? ink : .white)
        .padding(.horizontal, added ? 8 : 10).frame(height: compact ? 24 : 28)
        .background(added ? olive.opacity(0.15) : olive, in: Capsule())
    }
  }
  private func tileContent(_ product: TableeProduct, added: Bool) -> some View {
    Group {
      if family == .systemExtraLarge {
        HStack(spacing: 6) {
          photo(product).frame(maxWidth: 80, maxHeight: .infinity)
          labels(product, added: added).frame(maxWidth: .infinity)
        }
      } else {
        VStack(spacing: compact ? 2 : 4) {
          photo(product).frame(maxWidth: .infinity, maxHeight: .infinity)
          labels(product, added: added)
        }
      }
    }.padding(compact ? 5 : 8).frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(card, in: RoundedRectangle(cornerRadius: 14))
      .contentShape(RoundedRectangle(cornerRadius: 14))
  }
}
@main struct TableeWidget: Widget {
  let kind = "TableeMissing"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: MissingProvider()) { MissingView(entry: $0) }
      .configurationDisplayName("Les essentiels")
      .description("Ajoute tes produits habituels en un geste, puis découvre les suivants.")
      .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge, .accessoryCircular])
  }
}
