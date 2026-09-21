import XCTest

final class AppStoreScreenshots: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = [
            "--app-store-screenshots",
            "-AppleLanguages", "(en)",
            "-AppleLocale", "en_US"
        ]
        app.launch()
    }

    func testCaptureAppStoreScreenshots() throws {
        XCTAssertTrue(app.navigationBars["Map"].waitForExistence(timeout: 20))
        Thread.sleep(forTimeInterval: 15)
        capture("01-map")

        app.tabBars.buttons["Report"].tap()
        XCTAssertTrue(app.navigationBars["Report"].waitForExistence(timeout: 10))
        capture("02-quick-report")

        let notifyButton = app.buttons["Submit to CW & Notify CBPD"]
        scrollUntilHittable(notifyButton)
        capture("03-submit-options")

        app.tabBars.buttons["Saved"].tap()
        XCTAssertTrue(app.navigationBars["Saved reports"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Crosswalk safety"].waitForExistence(timeout: 10))
        capture("04-saved-reports")

        app.tabBars.buttons["Community"].tap()
        XCTAssertTrue(app.navigationBars["Community"].waitForExistence(timeout: 10))
        app.staticTexts["Contact Us"].firstMatch.tap()
        XCTAssertTrue(app.navigationBars["Contact Us"].waitForExistence(timeout: 10))
        capture("05-contact-us")

        app.navigationBars["Contact Us"].buttons.firstMatch.tap()
        XCTAssertTrue(app.navigationBars["Community"].waitForExistence(timeout: 10))
        app.staticTexts["Prepare an Anonymous Police Tip"].firstMatch.tap()
        XCTAssertTrue(app.navigationBars["Police Tip"].waitForExistence(timeout: 10))
        capture("06-notify-authorities")
    }

    private func scrollUntilHittable(_ element: XCUIElement) {
        for _ in 0..<10 where !element.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(element.isHittable, "Expected element was not visible after scrolling")
    }

    private func capture(_ name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(
            uniformTypeIdentifier: "public.png",
            name: "\(name).png",
            payload: screenshot.pngRepresentation,
            userInfo: nil
        )
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
