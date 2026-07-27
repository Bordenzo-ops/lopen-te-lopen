import ExpoModulesCore
import UIKit

/**
 * InstagramStoryModule
 *
 * Deelt een afbeelding rechtstreeks naar Instagram Stories op iOS.
 *
 * WAAROM NATIVE?
 * Instagram leest de te delen afbeelding NIET uit de URL-query, maar uit het
 * systeem-pasteboard onder eigen UTI-sleutels (com.instagram.sharedSticker.*).
 * Dat is de enige door Meta ondersteunde route en tegelijk de enige manier om
 * de iOS-sandbox te passeren: Instagram mag onze tmp-map niet lezen, het
 * pasteboard wél. Zie:
 * https://developers.facebook.com/docs/instagram-platform/sharing-to-stories/
 *
 * Volgorde is dwingend: eerst pasteboard vullen, daarna pas de URL openen.
 * Instagram leest het pasteboard direct bij het openen; is het leeg, dan toont
 * het "Kan verhaal niet delen".
 */

// Pasteboard-sleutels zoals gedocumenteerd door Meta.
private let backgroundImageKey = "com.instagram.sharedSticker.backgroundImage"
private let topColorKey        = "com.instagram.sharedSticker.backgroundTopColor"
private let bottomColorKey     = "com.instagram.sharedSticker.backgroundBottomColor"

private let shareScheme = "instagram-stories://share"

// Meta schrijft een venster van 5 minuten voor; daarna wist iOS het item zelf.
private let pasteboardTTL: TimeInterval = 60 * 5

public class InstagramStoryModule: Module {
  public func definition() -> ModuleDefinition {
    Name("InstagramStory")

    /**
     * Is Instagram geïnstalleerd en kunnen we het Stories-scheme openen?
     * Vereist "instagram-stories" in LSApplicationQueriesSchemes (app.json),
     * anders geeft canOpenURL altijd false terug.
     */
    AsyncFunction("isAvailableAsync") { () -> Bool in
      guard let url = URL(string: shareScheme) else { return false }
      return UIApplication.shared.canOpenURL(url)
    }.runOnQueue(.main)

    /**
     * Zet de afbeelding als volledig-scherm achtergrond op het pasteboard en
     * opent Instagram Stories.
     *
     * - fileUri:     file://-URI van de PNG (uit react-native-view-shot)
     * - appId:       waarde voor source_application (Facebook App ID; valt terug
     *                op de bundle identifier als hij leeg is)
     * - topColor:    hex-kleur voor de vulling boven/onder de afbeelding wanneer
     * - bottomColor: het toestelscherm hoger is dan 9:16 (voorkomt witte balken)
     *
     * Resolvet true als iOS Instagram daadwerkelijk heeft geopend.
     */
    AsyncFunction("shareBackgroundImageAsync") { (
      fileUri: String,
      appId: String?,
      topColor: String?,
      bottomColor: String?,
      promise: Promise
    ) in
      guard let baseUrl = URL(string: shareScheme),
            UIApplication.shared.canOpenURL(baseUrl) else {
        throw InstagramNotInstalledException()
      }

      // react-native-view-shot levert op iOS een file://-URI, maar wees
      // tolerant voor een kaal pad (dan is percent-decoding niet aan de orde).
      let fileUrl: URL
      if fileUri.hasPrefix("file://"), let parsed = URL(string: fileUri) {
        fileUrl = parsed
      } else {
        fileUrl = URL(fileURLWithPath: fileUri)
      }

      guard let imageData = try? Data(contentsOf: fileUrl), !imageData.isEmpty else {
        throw ImageReadException(fileUri)
      }

      var item: [String: Any] = [backgroundImageKey: imageData]
      if let topColor = topColor, !topColor.isEmpty {
        item[topColorKey] = topColor
      }
      if let bottomColor = bottomColor, !bottomColor.isEmpty {
        item[bottomColorKey] = bottomColor
      }

      UIPasteboard.general.setItems(
        [item],
        options: [.expirationDate: Date().addingTimeInterval(pasteboardTTL)]
      )

      // source_application is volgens Meta verplicht. Zonder eigen Facebook App ID
      // sturen we de bundle identifier mee; Instagram gebruikt de waarde alleen
      // voor attributie en weigert de share er niet om.
      let source = (appId?.isEmpty == false)
        ? appId!
        : (Bundle.main.bundleIdentifier ?? "unknown")

      var components = URLComponents(string: shareScheme)
      components?.queryItems = [URLQueryItem(name: "source_application", value: source)]

      guard let shareUrl = components?.url else {
        throw InstagramNotInstalledException()
      }

      UIApplication.shared.open(shareUrl, options: [:]) { opened in
        promise.resolve(opened)
      }
    }.runOnQueue(.main)
  }
}

internal final class InstagramNotInstalledException: Exception {
  override var reason: String {
    "Instagram is niet beschikbaar op dit toestel."
  }
}

internal final class ImageReadException: GenericException<String> {
  override var reason: String {
    "Kon de gedeelde afbeelding niet lezen: \(param)"
  }
}
