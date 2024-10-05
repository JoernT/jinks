document.addEventListener('DOMContentLoaded', function() {
    const modeSwitch = document.getElementById('colorMode');
    if (modeSwitch) {
        modeSwitch.addEventListener('click', function() {
            let theme = document.body.dataset.theme || localStorage.getItem('tp.theme');
            if (!theme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                // User prefers dark mode
                theme = 'dark';
            }
            const newTheme = theme === 'dark' ? 'light' : 'dark';
            document.body.dataset.theme = newTheme;
            localStorage.setItem('tp.theme', newTheme);
            modeSwitch.classList.toggle('theme-toggle--toggled');
        });
    }

    let theme = document.body.dataset.theme || localStorage.getItem('tp.theme');
    if (theme) {
        document.body.dataset.theme = theme;
        localStorage.setItem('tp.theme', theme);
        modeSwitch.classList.toggle('theme-toggle--toggled', theme === 'dark');
    }
});