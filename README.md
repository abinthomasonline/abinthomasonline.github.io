# abinthomasonline.github.io

Static GitHub Pages site for `abinthomas.in`. There is no build step.

## Structure

- `index.html`: homepage
- `blog/index.html`: writing archive
- `blog/<slug>/index.html`: public article routes
- `assets/css` and `assets/js`: shared site and plain-article assets
- `images`: public image assets

See `blog/README.md` for the writing workflow.

## Local preview

Run this command from the repository root:

```sh
python3 -m http.server 8000
```

Then open `http://127.0.0.1:8000/`.
