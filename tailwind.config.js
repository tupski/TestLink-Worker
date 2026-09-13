/** Tailwind + Preline plugin (variant hs-* untuk komponen Preline). */
module.exports = {
    content: ['./*.html', './js/**/*.js'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif']
            },
            colors: {
                surface: '#020617',
                card: '#0f172a'
            }
        }
    },
    plugins: [require('preline/plugin')]
};
