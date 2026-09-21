import Foundation

struct ChecklistCatalog: Codable {
    let version: Int
    let title: String
    let instructions: String
    let categories: [ChecklistCategory]

    static func load() -> ChecklistCatalog {
        guard let url = Bundle.main.url(forResource: "checklist_catalog", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let catalog = try? JSONDecoder().decode(ChecklistCatalog.self, from: data)
        else {
            return ChecklistCatalog(version: 0, title: "Checklist unavailable", instructions: "", categories: [])
        }
        return catalog
    }
}

struct ChecklistCategory: Codable, Identifiable {
    let id: String
    let title: String
    let description: String
    let reportCategories: [String]
    let questions: [ChecklistQuestion]

    enum CodingKeys: String, CodingKey {
        case id, title, description, questions
        case reportCategories = "report_categories"
    }

    func applies(to issues: Set<IssueCategory>) -> Bool {
        !Set(reportCategories).isDisjoint(with: Set(issues.map(\.rawValue)))
    }
}

struct ChecklistQuestion: Codable, Identifiable {
    let id: String
    let text: String
}

