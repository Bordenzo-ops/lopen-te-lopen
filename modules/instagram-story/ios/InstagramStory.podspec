Pod::Spec.new do |s|
  s.name           = 'InstagramStory'
  s.version        = '1.0.0'
  s.summary        = 'Deelt een afbeelding naar Instagram Stories via het iOS-pasteboard.'
  s.description    = 'Lokale Expo-module: zet een PNG als backgroundImage op UIPasteboard met de com.instagram.sharedSticker.* sleutels en opent instagram-stories://share.'
  s.author         = 'Lopen te Lopen'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = 'MIT'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
