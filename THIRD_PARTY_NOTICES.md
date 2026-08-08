# Third-party notices

Burrow includes third-party software distributed under its own terms. This notice is an inventory aid, not a replacement for the license texts shipped with each component or for legal review.

## Bundled authlib-injector

`resources/authlib-injector.jar` is authlib-injector **1.2.8**, upstream commit `5437f5b465ee3f5be0a1e5e1ae3c50978114f6fb`, by yushijinhun and contributors. Burrow verifies the bundled or fallback copy against SHA-256 `9c7f4343e6c82034958ffb48c14a2cb0c85928be7283103ce17da00c6d5a7b10` before launch.

- Project: <https://github.com/yushijinhun/authlib-injector>
- Corresponding release/source: <https://github.com/yushijinhun/authlib-injector/releases/tag/v1.2.8>
- License: GNU Affero General Public License, version 3
- Full license text in the JAR: `META-INF/licenses/authlib-injector.txt`

The JAR also carries its own notices for bundled components:

- ASM — BSD-style 3-clause terms in `META-INF/licenses/asm.txt`
- NanoHTTPD — BSD-style 3-clause terms in `META-INF/licenses/nanohttpd.txt`
- JSON.simple — Apache License 2.0 in `META-INF/licenses/json-simple.txt`

Redistributions that include this JAR must preserve the applicable notices and satisfy the corresponding source and license obligations.

## JavaScript dependencies

Runtime and development dependencies are declared in `package.json` and resolved exactly by `package-lock.json`. Packaged applications may include a subset selected by electron-builder. Their licenses remain the property of their respective authors.

Before redistributing a release, generate or review the dependency license inventory for the exact package output; do not treat this summary as a complete machine-generated bill of materials.

## Minecraft and provider content

Minecraft, Mojang, Microsoft, Modrinth, CurseForge, Java distributions, mods, modpacks, resource packs, shaders, and provider metadata retain their respective trademarks, copyrights, and distribution terms. Burrow is not affiliated with Mojang or Microsoft.
