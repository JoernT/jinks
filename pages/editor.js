window.addEventListener('DOMContentLoaded', () => {
    let appConfig = {};

    const editor = document.getElementById('appConfig');
    const mergedView = document.querySelector('#mergedConfig pb-code-highlight');
    const form = document.getElementById('config');
    const output = document.querySelector('.output');
    const errors = document.querySelector('.error');

    const spinner = document.getElementById('spinner');
    spinner.style.display = 'none';

    const applyConfigButton = document.getElementById('apply-config');
    const dryRunButton = document.getElementById('dry-run');

    let isProcessing = false;

    function createOpenButtonHtml(abbrev) {
        return `<a id="open-action" class="action" href="../${abbrev}" target="_new">
        <svg xmlns="http://www.w3.org/2000/svg" class="ionicon" viewBox="0 0 512 512"><path d="M384 224v184a40 40 0 01-40 40H104a40 40 0 01-40-40V168a40 40 0 0140-40h167.48M336 64h112v112M224 288L440 72" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/></svg>
        </a>`;
    }

    function getConfig(appConfig) {
        return fetch('api/expand', {
            method: 'post',
            body: JSON.stringify(appConfig),
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then((response) => {
            if (!response.ok) {
                return Promise.reject(response.status);
            }
    
            return response.json();
        });
    }

    async function loadApps() {
        try {
            const response = await fetch('api/configurations');
            if (!response.ok) {
                throw new Error(response.status);
            }
            const apps = await response.json();
            const nav = document.querySelector('.installed');
			nav.innerHTML = '';
            apps.forEach((app) => {
                if (app.type !== 'installed') {
                    return;
                }
                const a = document.createElement('a');
                a.innerHTML = `
                    <div>
                        <img src="pages/app.svg" width="64px">
                        <h3>${app.title}</h3>
                    </div>
                    <nav class="actions"></nav>
                `;
                const actions = a.querySelector('.actions');
                if (app.type === 'installed') {
                    actions.innerHTML = createOpenButtonHtml(app.config.pkg.abbrev);
                }
                if (app.description) {
                    a.dataset.tooltip = app.description;
                    a.dataset.placement = 'right';
                }
                nav.appendChild(a);

                a.addEventListener('click', () => {
                    appConfig = app.config;
                    editor.value = JSON.stringify(app.config, null, 4);
                    form.querySelector('[name="id"]').value = appConfig.id;
                    form.querySelector('[name="label"]').value = appConfig.label;
                    form.querySelector('[name="abbrev"]').value = appConfig.pkg.abbrev;
                    form.querySelectorAll('[name="base"]').forEach((input) => {
                        input.checked = appConfig.extends.includes(input.value);
                    });
                    form.querySelectorAll('[name="feature"]').forEach((input) => {
                        input.checked = appConfig.extends.includes(input.value);
                    });
                    update();
                });
            });
        } catch (error) {
            console.log(error);
        }
    }

    async function displaySpinnerDuringCallback(text, callback) {
        spinner.style.display = 'block';
        spinner.innerText = text;
        try {
            return await callback();
        } finally {
            spinner.style.display = 'none';
        }
    }

    async function blockUiDuringCallback(callback) {
        if (isProcessing) {
            throw new Error('Process already in progress');
        }
        // A double-click on deploying can cause a deadlock. Prevent double-clicks at least from the front-end.
        isProcessing = true;
        applyConfigButton.disabled = true;
        dryRunButton.disabled = true;
        try {
            return await callback()
        } finally {
            applyConfigButton.disabled = false;
            dryRunButton.disabled = false;
            isProcessing = false;
        }
    }

    async function doDeploy(abbrev) {
        return displaySpinnerDuringCallback(`Deploying app ${abbrev}…`, async () => {
            errors.innerHTML = '';

            try {
                const response = await fetch(
                    new URL(`api/generator/${abbrev}/deploy`, window.location),
                    {
                        method: 'POST',
                        body: {},
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    },
                );

                if (!response.ok) {
                    const text = await response.text();
                    errors.innerHTML = text;

                    throw new Error(response.status);
                }

                output.innerHTML = `Package is deployed. Visit it here ${createOpenButtonHtml(abbrev)}`;
                loadApps();
            } catch (error) {
                console.log(error);
            }
        });
    }

    async function process(dryRun) {
        await blockUiDuringCallback(async () => {
            const result = await displaySpinnerDuringCallback(
                `Applying configuration…`,
                async () => {
                    try {
                        // Reset state
                        output.innerHTML = '';
                        errors.innerHTML = '';

                        const overwrite = document.querySelector('[name=overwrite]').value;
                        const config = JSON.parse(editor.value);
                        // const profile = appConfig.pkg.abbrev;
                        const url = new URL(`api/generator`, window.location);
                        url.searchParams.set('overwrite', overwrite);
                        if (dryRun) {
                            url.searchParams.set('dry', 'true');
                        }
                        const response = await fetch(url, {
                            method: 'POST',
                            body: JSON.stringify(config),
                            headers: {
                                'Content-Type': 'application/json',
                            },
                        });
                        if (!response.ok) {
                            const text = await response.text();
                            errors.innerHTML = text;

                            throw new Error(response.status);
                        }
                        const result = await response.json();

                        return result;
                    } catch (error) {
                        console.log(error);
                        // Fully stop processing.
                        throw error;
                    }
                },
            );

            if (result.messages) {
                output.innerHTML = '';
                result.messages.forEach((message) => {
                    if (!message.type) {
                        return;
                    }
                    const li = document.createElement('li');
                    li.innerHTML = `
                    <span class='badge ${message.type === 'conflict' ? 'alert' : ''}'>${message.type}</span> 
                    ${message.path} ${message.source ? ' from ' + message.source : ''}
                `;

                    output.appendChild(li);
                });
            }

            if (
                result.nextStep.action === 'DEPLOY' ||
                result.config._update === false
            ) {
                await doDeploy(result.config.pkg.abbrev);
            }
        });
    }

    function updateConfig(updateEditor = true) {
        getConfig(appConfig).then((mergedConfig) => {
            mergedView.code = JSON.stringify(mergedConfig, null, 2);
        });
        if (updateEditor) {
            editor.value = JSON.stringify(appConfig, null, 2);
        }
    }

    function update() {
        const formData = new FormData(form);
        if (formData.get('abbrev') !== '' && formData.get('label') === '') {
            form.querySelector('[name="label"]').value = formData.get('abbrev');
        }
        formData.forEach((value, key) => {
            if (key !== 'base' && key !== 'feature' && key !== 'abbrev') {
                appConfig[key] = value;
            }
        });
        appConfig.pkg = {
            abbrev: formData.get('abbrev')
        };
        appConfig.extends = formData.getAll('base').concat(formData.getAll('feature'));

        updateConfig();
    }

    applyConfigButton.addEventListener('click', (ev) => {
        ev.preventDefault();
        process(false);
    });

    form.addEventListener('change', () => update());

    editor.addEventListener('update', () => {
        try {
            appConfig = JSON.parse(editor.value);
            updateConfig(false);
        } catch (error) {
            console.log(error);
        }
    });

    loadApps();
});