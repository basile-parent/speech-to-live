package com.speechtolive.app.speech

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class NativeSpeechRecognitionPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return if (name == NativeSpeechRecognitionModule.NAME) {
      NativeSpeechRecognitionModule(reactContext)
    } else {
      null
    }
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      mapOf(
        NativeSpeechRecognitionModule.NAME to
          ReactModuleInfo(
            NativeSpeechRecognitionModule.NAME,
            NativeSpeechRecognitionModule.NAME,
            false,
            false,
            false,
            true,
          ),
      )
    }
  }
}
