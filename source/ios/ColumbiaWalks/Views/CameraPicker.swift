import CoreLocation
import ImageIO
import SwiftUI
import UIKit

struct PhotoSelectionGeneration {
    private var current = UUID()

    mutating func begin() -> UUID {
        current = UUID()
        return current
    }

    mutating func invalidate() {
        current = UUID()
    }

    func accepts(_ generation: UUID) -> Bool {
        current == generation
    }
}

struct PhotoSelection {
    let data: Data
    let coordinate: CLLocationCoordinate2D?

    init(data: Data, metadata: [String: Any]? = nil) {
        self.data = data
        coordinate = metadata.flatMap { PhotoMetadata.coordinate(from: $0) }
            ?? PhotoMetadata.coordinate(from: data)
    }
}

enum PhotoMetadata {
    static func coordinate(from data: Data) -> CLLocationCoordinate2D? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil)
                as? [String: Any] else { return nil }
        return coordinate(from: properties)
    }

    static func coordinate(from properties: [String: Any]) -> CLLocationCoordinate2D? {
        guard let gps = (properties[kCGImagePropertyGPSDictionary as String] as? [String: Any])
                ?? (properties["{GPS}"] as? [String: Any]),
              var latitude = number(gps[kCGImagePropertyGPSLatitude as String]),
              var longitude = number(gps[kCGImagePropertyGPSLongitude as String]) else {
            return nil
        }
        let latitudeReference = string(gps[kCGImagePropertyGPSLatitudeRef as String]).uppercased()
        let longitudeReference = string(gps[kCGImagePropertyGPSLongitudeRef as String]).uppercased()
        if latitudeReference == "S" { latitude = -abs(latitude) }
        if longitudeReference == "W" { longitude = -abs(longitude) }
        guard (-90...90).contains(latitude), (-180...180).contains(longitude) else {
            return nil
        }
        return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    private static func number(_ value: Any?) -> Double? {
        if let number = value as? NSNumber { return number.doubleValue }
        if let text = value as? String { return Double(text) }
        return nil
    }

    private static func string(_ value: Any?) -> String {
        value as? String ?? ""
    }
}

struct CameraPicker: UIViewControllerRepresentable {
    let onImage: (PhotoSelection) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        let parent: CameraPicker
        init(parent: CameraPicker) { self.parent = parent }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = info[.originalImage] as? UIImage,
               let data = image.jpegData(compressionQuality: 0.95) {
                parent.onImage(PhotoSelection(
                    data: data,
                    metadata: info[.mediaMetadata] as? [String: Any]
                ))
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

struct CameraCaptureSheet: View {
    let onImage: (PhotoSelection) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack(alignment: .topLeading) {
            CameraPicker(onImage: onImage)
                .ignoresSafeArea()

            Button {
                dismiss()
            } label: {
                Label("Cancel camera", systemImage: "xmark")
                    .labelStyle(.iconOnly)
                    .font(.headline)
                    .padding(12)
                    .background(.ultraThinMaterial, in: Circle())
            }
            .foregroundStyle(Color.cwText)
            .padding(.leading, 16)
            .padding(.top, 16)
            .accessibilityLabel("Cancel camera")
        }
    }
}
