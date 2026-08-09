# Blog structure

Public articles live at `blog/<slug>/index.html` and therefore publish at `/blog/<slug>/`.

## Add a post

1. Create `blog/<new-slug>/index.html`.
2. Use `/assets/css/post.css` and `/assets/js/theme.js` for a plain article.
3. Add the title and date to both `/blog/index.html` and the homepage `/index.html`.
4. Add the canonical URL to `/sitemap.xml`.
5. Test the article at 320px, 390px, and desktop widths in light and dark themes.

Interactive posts may keep post-specific CSS, JavaScript, and visual-only pages inside their article directory. Visual-only pages should be marked `noindex` and linked with root-absolute paths.
