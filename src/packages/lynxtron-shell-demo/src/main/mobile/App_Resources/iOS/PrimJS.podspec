Pod::Spec.new do |spec|
  spec.name = 'PrimJS'
  spec.version = '4.2.0-alpha.0'
  spec.summary = 'PrimJS with private C++ headers for the NativeScript host.'
  spec.homepage = 'https://github.com/lynx-family/primjs'
  spec.license = 'MIT'
  spec.author = 'The Lynx Authors'
  spec.source = {
    :git => 'https://github.com/lynx-family/primjs.git',
    :commit => '46ad1005ab517638f980c0cb44294722c7a5d853'
  }
  spec.platform = :ios, '9.0'
  spec.compiler_flags = '-Wall', '-Wno-shorten-64-to-32', '-Os'
  spec.pod_target_xcconfig = {
    'GCC_PREPROCESSOR_DEFINITIONS' =>
      'OS_IOS=1 JSC_OBJC_API_ENABLED=1 ENABLE_CODECACHE ENABLE_VIRTUAL_STACK=1',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'gnu++17',
    'HEADER_SEARCH_PATHS' =>
      '"$(PODS_TARGET_SRCROOT)/src" "$(PODS_TARGET_SRCROOT)/src/interpreter"'
  }
  spec.default_subspecs = 'quickjs'

  # NativeScript scans every public framework header as Objective-C. PrimJS is
  # an implementation dependency of Lynx, so keep its C++ headers private and
  # compile only the implementation files into the framework target.
  spec.subspec 'quickjs' do |subspec|
    subspec.pod_target_xcconfig = {
      'GCC_PREPROCESSOR_DEFINITIONS' =>
        'ENABLE_PRIMJS_SNAPSHOT ENABLE_COMPATIBLE_MM ENABLE_LEPUSNG LYNX_SIMPLIFY=0'
    }
    subspec.source_files =
      'src/gc/*.{h,cc}',
      'src/interpreter/quickjs/**/*.{h,cc}',
      'src/interpreter/primjs/ios/embedded.S',
      'src/inspector/interface.h'
    subspec.private_header_files =
      'src/gc/*.h',
      'src/interpreter/quickjs/**/*.h',
      'src/inspector/interface.h'
    subspec.dependency 'PrimJS/log'
  end

  spec.subspec 'napi' do |napi|
    napi.pod_target_xcconfig = {
      'HEADER_SEARCH_PATHS' => '"${PODS_ROOT}/PrimJS"'
    }

    napi.subspec 'core' do |subspec|
      subspec.source_files =
        'src/napi/*.{h,cc}',
        'src/napi/common/*.{h,cc}'
      subspec.private_header_files =
        'src/napi/*.h',
        'src/napi/common/*.h'
    end

    napi.subspec 'env' do |subspec|
      subspec.source_files = 'src/napi/env/*.{h,cc}'
      subspec.private_header_files = 'src/napi/env/*.h'
      subspec.dependency 'PrimJS/napi/core'
    end

    napi.subspec 'quickjs' do |subspec|
      subspec.source_files = 'src/napi/quickjs/*.{h,cc}'
      subspec.private_header_files = 'src/napi/quickjs/*.h'
      subspec.dependency 'PrimJS/napi/core'
      subspec.dependency 'PrimJS/quickjs'
    end

    napi.subspec 'jsc' do |subspec|
      subspec.pod_target_xcconfig = {
        'GCC_PREPROCESSOR_DEFINITIONS' => 'JSC_OBJC_API_ENABLED=0'
      }
      subspec.source_files = 'src/napi/jsc/*.{h,cc}'
      subspec.private_header_files = 'src/napi/jsc/*.h'
      subspec.dependency 'PrimJS/napi/core'
      subspec.dependency 'PrimJS/log'
      subspec.dependency 'PrimJS/quickjs'
      subspec.framework = 'JavaScriptCore'
    end
  end

  spec.subspec 'log' do |subspec|
    subspec.source_files =
      'src/basic/log/logging.*',
      'src/basic/log/primjs_logging.cc',
      'src/interpreter/quickjs/include/base_export.h'
    subspec.private_header_files =
      'src/basic/log/logging.h',
      'src/interpreter/quickjs/include/base_export.h'
  end
end
