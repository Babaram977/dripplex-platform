# Vendored brand fonts

These two files are here so `scripts/generate-icons.mjs` renders the Play
feature graphic identically on every machine. The generator points fontconfig
at this directory and ignores whatever the host has installed.

They are **not** shipped in the app bundle. The mobile app loads its webfonts
the normal way; these exist only to rasterise one PNG at build time.

| File                   | Family              | Source                                               |
| ---------------------- | ------------------- | ---------------------------------------------------- |
| `Poppins-SemiBold.ttf` | Poppins, weight 600 | Google Fonts (`fonts.gstatic.com`), via the CSS2 API |
| `Inter-Regular.ttf`    | Inter, weight 400   | Google Fonts (`fonts.gstatic.com`), via the CSS2 API |

Both are the faces named in the locked Figma type system — Poppins for
headings, Inter for body — see `apps/customer-web/src/app/layout.tsx`.

## Licence

Both families are licensed under the **SIL Open Font License, Version 1.1**,
which permits bundling and redistribution with the reserved-name and
same-licence conditions intact. Full text: <https://scripts.sil.org/OFL>

- Poppins — Copyright the Indian Type Foundry and the Poppins Project Authors
- Inter — Copyright the Inter Project Authors

## Replacing them

Swap a file and rerun the generator; the committed PNG will change and CI will
flag it until the new bytes are committed. Do not rename the files without
updating `FONT_DIR` usage in `scripts/generate-icons.mjs` — the SVG asks for
the family names `Poppins SemiBold` and `Inter`, which fontconfig resolves from
the files themselves, not the filenames.
