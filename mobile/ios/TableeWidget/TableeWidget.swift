import WidgetKit
import SwiftUI

struct MissingEntry: TimelineEntry { let date: Date; let count: Int; let connected: Bool }
struct MissingProvider: TimelineProvider {
  func placeholder(in context: Context) -> MissingEntry { MissingEntry(date: .now, count: 0, connected: true) }
  func entry() -> MissingEntry {
    let data = try? TableeStore.access { $0 }
    return MissingEntry(date: .now, count: data?.pending.count ?? 0, connected: data?.account != nil)
  }
  func getSnapshot(in context: Context, completion: @escaping (MissingEntry) -> Void) { completion(entry()) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<MissingEntry>) -> Void) { completion(Timeline(entries: [entry()], policy: .after(Date().addingTimeInterval(900)))) }
}
struct MissingView: View {
  let entry: MissingEntry
  @Environment(\.widgetFamily) var family
  var body: some View {
    if family == .accessoryCircular {
      Image(systemName: "cart.badge.plus").widgetURL(URL(string: "coursesapp://ajout"))
    } else {
      VStack(alignment: .leading, spacing: 8) {
        Label("Tablée Maison", systemImage: "leaf").font(.caption).foregroundStyle(.secondary)
        Text("Il me manque…").font(.title2.bold())
        Text(entry.connected ? (entry.count > 0 ? "\(entry.count) ajout(s) Siri à retrouver" : "Note un produit pour les prochaines courses") : "Connecte-toi dans Courses").font(.caption)
        Spacer(minLength: 0)
        Label("Ajouter un produit", systemImage: "plus.circle.fill").font(.subheadline.bold())
      }.foregroundStyle(Color(red: 0.24, green: 0.34, blue: 0.20))
        .containerBackground(Color(red: 0.95, green: 0.96, blue: 0.91), for: .widget)
        .widgetURL(URL(string: "coursesapp://ajout"))
    }
  }
}
@main struct TableeWidget: Widget {
  let kind = "TableeMissing"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: MissingProvider()) { MissingView(entry: $0) }
      .configurationDisplayName("Il me manque…")
      .description("Note tes manques au fil des jours. Retrouve aussi tes ajouts Siri.")
      .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular])
  }
}
