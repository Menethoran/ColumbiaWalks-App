import Combine
import CoreLocation
import Foundation

@MainActor
final class LocationService: NSObject, ObservableObject, @preconcurrency CLLocationManagerDelegate {
    @Published private(set) var authorizationStatus: CLAuthorizationStatus
    @Published private(set) var isLocating = false
    @Published private(set) var errorMessage: String?
    var onLocation: ((CLLocationCoordinate2D) -> Void)?

    private let manager = CLLocationManager()

    override init() {
        authorizationStatus = manager.authorizationStatus
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
    }

    func requestLocation(_ completion: @escaping (CLLocationCoordinate2D) -> Void) {
        onLocation = completion
        errorMessage = nil
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            isLocating = true
            manager.requestLocation()
        case .denied, .restricted:
            errorMessage = "Location permission was not granted. You can still tap the map to choose a location."
        @unknown default:
            errorMessage = "A current location is unavailable."
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorizationStatus = manager.authorizationStatus
        if manager.authorizationStatus == .authorizedAlways || manager.authorizationStatus == .authorizedWhenInUse {
            isLocating = true
            manager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        isLocating = false
        guard let coordinate = locations.last?.coordinate else { return }
        onLocation?(coordinate)
        onLocation = nil
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        isLocating = false
        errorMessage = "A current GPS fix is unavailable. Check Location Services, or tap the map."
        onLocation = nil
    }
}

enum ColumbiaArea {
    static let center = CLLocation(latitude: 40.0337, longitude: -76.5044)
    static func contains(_ coordinate: CLLocationCoordinate2D) -> Bool {
        center.distance(from: CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)) <= 16_000
    }
}

