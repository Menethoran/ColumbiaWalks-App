import MapKit
import SwiftUI

struct MapScreen: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var location: LocationService
    @State private var camera: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: AppState.columbiaCenter,
            span: MKCoordinateSpan(latitudeDelta: 0.035, longitudeDelta: 0.035)
        )
    )

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                AppHeader("Choose a location", subtitle: "Tap the map to place the report pin, or use your current location.")
                    .padding(.horizontal)

                MapReader { proxy in
                    Map(position: $camera) {
                        if appState.locationConfirmed {
                            Marker("Report location", coordinate: appState.reportCoordinate)
                                .tint(Color.cwGreen)
                        }
                    }
                    .mapStyle(.standard(elevation: .realistic))
                    .mapControls {
                        MapCompass()
                        MapScaleView()
                    }
                    .onTapGesture { point in
                        guard let coordinate = proxy.convert(point, from: .local) else { return }
                        appState.selectLocation(coordinate, source: .manualMap)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .padding(.horizontal)

                VStack(alignment: .leading, spacing: 8) {
                    Label(locationText, systemImage: "mappin.and.ellipse")
                        .font(.subheadline.monospacedDigit())
                    if appState.locationConfirmed && !ColumbiaArea.contains(appState.reportCoordinate) {
                        Label("This point appears to be outside the Columbia area. You may still save it.", systemImage: "exclamationmark.triangle")
                            .font(.footnote)
                            .foregroundStyle(Color.cwWarning)
                    }
                    if let error = location.errorMessage {
                        Text(error).font(.footnote).foregroundStyle(Color.cwError)
                    }
                    HStack {
                        Button {
                            location.requestLocation { coordinate in
                                appState.selectLocation(coordinate, source: .deviceGPS)
                                camera = .region(MKCoordinateRegion(
                                    center: coordinate,
                                    span: MKCoordinateSpan(latitudeDelta: 0.008, longitudeDelta: 0.008)
                                ))
                            }
                        } label: {
                            Label(location.isLocating ? "Finding…" : "Use my location", systemImage: "location.fill")
                        }
                        .buttonStyle(.bordered)
                        .disabled(location.isLocating)

                        Spacer()

                        Button("Report this spot") {
                            appState.selectedTab = .report
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(!appState.locationConfirmed)
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 8)
            }
            .background(Color.cwSurface)
            .navigationTitle("Map")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var locationText: String {
        guard appState.locationConfirmed else { return "No report pin selected" }
        return String(
            format: "Report pin: %.6f, %.6f",
            appState.reportCoordinate.latitude,
            appState.reportCoordinate.longitude
        )
    }
}
