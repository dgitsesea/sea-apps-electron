require('dotenv').config();

const path = require('path');
const fs = require('fs');

const {
    app,
    BrowserWindow,
    shell,
    Menu,
    WebContentsView,
    ipcMain,
    Notification
} = require('electron');

const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;

log.info('Aplicación iniciada.');

const APP_USER_MODEL_ID = 'com.sea.dgitsuite';
const DEFAULT_URL = process.env.PAGINA_ABRIR || 'https://login.seseaguanajuato.org';
const DEFAULT_UPDATE_CHECK_INTERVAL_MINUTES = 30;
const MIN_UPDATE_CHECK_INTERVAL_MINUTES = 1;
 
if (process.platform === 'win32') {
    app.setAppUserModelId(APP_USER_MODEL_ID);
}

const ALLOWED_ORIGINS = [
    'https://sistemaestatalanticorrupcion.guanajuato.gob.mx',
    'https://seseaguanajuato.org',
    'https://publico.seseaguanajuato.org',
    'https://plataformadigital.guanajuato.gob.mx',
    'https://intranet.seseaguanajuato.org',
    'https://login.seseaguanajuato.org',
    'https://devlogin.seseaguanajuato.org',
    'https://mesadeayuda.seseaguanajuato.org',
    'https://devsireg.seseaguanajuato.org',
    'https://sireg.seseaguanajuato.org',
    'https://serviciosdigitalessea.guanajuato.gob.mx/declaranet/'
];

const ALLOWED_MAILTO_RECIPIENTS = [
    'dgit.sesea@guanajuato.gob.mx',
    'pde.sesea@guanajuato.gob.mx',
    'aegarciam@guanajuato.gob.mx'
];

let mainWindow;
let mainView;
let supportWindow = null;
let manualUpdateCheckInProgress = false;
let automaticUpdateCheckInProgress = false;
let updateReadyToInstall = false;
let updateInstallInProgress = false;
let lastNativeUpdateNotificationVersion = null;
let currentUrl = DEFAULT_URL;

const APP_MENU_GROUPS = {
    recursos: [
        {
            label: 'SEA Guanajuato',
            url: 'https://sistemaestatalanticorrupcion.guanajuato.gob.mx/'
        },
        {
            label: 'SESEA Guanajuato',
            url: 'https://seseaguanajuato.org/'
        },
        {
            label: 'Portal Público',
            url: 'https://publico.seseaguanajuato.org/'
        }
    ],
    sistemas: [
        {
            label: 'Plataforma Digital',
            url: 'https://plataformadigital.guanajuato.gob.mx/'
        },
        {
            label: 'Intranet SESEA',
            url: 'https://intranet.seseaguanajuato.org/'
        },
        {
            label: 'SIREG',
            url: 'https://sireg.seseaguanajuato.org/'
        }
    ],
    soporte: [
        {
            label: 'Mesa de Ayuda SEA',
            url: 'https://sistemaestatalanticorrupcion.guanajuato.gob.mx/mesa-de-ayuda/'
        }
    ]
};

const getConfigPath = () => path.join(app.getPath('userData'), 'last-url.json');

const isAllowedUrl = (url) => {
    try {
        return ALLOWED_ORIGINS.includes(new URL(url).origin);
    } catch {
        return false;
    }
};

const getSafeAppUrl = (url, fallback = DEFAULT_URL) => {
    if (isAllowedUrl(url)) return url;
    if (isAllowedUrl(fallback)) return fallback;
    return 'https://plataformadigital.guanajuato.gob.mx/';
};

const getUpdateCheckIntervalMinutes = () => {
    const configuredMinutes = Number(process.env.UPDATE_CHECK_INTERVAL_MINUTES);

    if (!Number.isFinite(configuredMinutes) || configuredMinutes <= 0) {
        return DEFAULT_UPDATE_CHECK_INTERVAL_MINUTES;
    }

    return Math.max(MIN_UPDATE_CHECK_INTERVAL_MINUTES, configuredMinutes);
};

const isAllowedExternalUrl = (url) => {
    try {
        const parsedUrl = new URL(url);

        if (parsedUrl.protocol === 'mailto:') {
            const recipients = parsedUrl.pathname
                .split(',')
                .map((recipient) => decodeURIComponent(recipient).trim().toLowerCase())
                .filter(Boolean);

            return recipients.length > 0
                && recipients.every((recipient) => ALLOWED_MAILTO_RECIPIENTS.includes(recipient));
        }

        return parsedUrl.protocol === 'https:' && isAllowedUrl(url);
    } catch {
        return false;
    }
};

const loadAllowedUrl = (url) => {
    if (!mainView || !mainView.webContents) return false;

    if (!isAllowedUrl(url)) {
        log.warn(`NavegaciÃ³n bloqueada: ${url}`);
        return false;
    }

    currentUrl = url;
    sendNavigationState(url);
    mainView.webContents.loadURL(url);
    return true;
};

const readSavedConfig = (fallbackUrl) => {
    const configPath = getConfigPath();
    const config = {
        lastUrl: fallbackUrl,
        lastVersion: app.getVersion()
    };

    try {
        if (!fs.existsSync(configPath)) return config;

        const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (!savedConfig || typeof savedConfig !== 'object') return config;

        return {
            ...config,
            ...savedConfig,
            lastUrl: getSafeAppUrl(savedConfig.lastUrl, fallbackUrl)
        };
    } catch (err) {
        log.error('Error leyendo config', err);
        return config;
    }
};

const writeSavedConfig = (config) => {
    try {
        fs.writeFileSync(getConfigPath(), JSON.stringify(config));
    } catch (err) {
        log.error('Error guardando config', err);
    }
};

const sendUpdateStatus = (status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-status', status);
    }
};

const sendNavigationState = (url) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('navigation-state', { url });
    }
};

const focusMainWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
};

const getNotificationIconPath = () => {
    const iconPaths = [
        path.join(__dirname, 'build', 'icon.png'),
        path.join(__dirname, 'ico.ico')
    ];

    return iconPaths.find((iconPath) => fs.existsSync(iconPath));
};

const showNativeNotification = ({ title, body }) => {
    if (!Notification.isSupported()) {
        log.warn('Notificaciones nativas no soportadas en este sistema.');
        return;
    }

    const icon = getNotificationIconPath();
    const notification = new Notification({
        title,
        body,
        silent: false,
        ...(icon ? { icon } : {})
    });

    notification.on('click', focusMainWindow);
    notification.show();
};

const showUpdateReadyNotification = (info) => {
    const version = info && info.version ? info.version : 'disponible';

    if (lastNativeUpdateNotificationVersion === version) return;
    lastNativeUpdateNotificationVersion = version;

    showNativeNotification({
        title: 'Actualización lista',
        body: info && info.version
            ? `Recursos Digitales SEA v${info.version} ya se descargó. Reinicia para instalarla.`
            : 'Recursos Digitales SEA tiene una actualización lista para instalar.'
    });
};

const runDownloadedUpdateInstaller = () => {
    if (updateInstallInProgress) return true;
    if (!updateReadyToInstall) return false;

    updateInstallInProgress = true;
    updateReadyToInstall = false;
    log.info('Instalando actualización en modo silencioso...');
    autoUpdater.quitAndInstall(true, true);
    return true;
};

const checkForUpdatesAutomatically = async () => {
    if (!app.isPackaged) return;

    if (
        manualUpdateCheckInProgress
        || automaticUpdateCheckInProgress
        || updateReadyToInstall
        || updateInstallInProgress
    ) {
        log.info('Verificación automática de updates omitida: hay otra revisión o instalación en curso.');
        return;
    }

    automaticUpdateCheckInProgress = true;

    try {
        log.info('Verificación automática de updates...');
        await autoUpdater.checkForUpdates();
    } catch (err) {
        automaticUpdateCheckInProgress = false;
        log.error(`Error en verificación automática de updates: ${err == null ? 'unknown' : err.message}`);
    }
};

const clearDirectory = (directoryPath) => {
    try {
        if (fs.existsSync(directoryPath)) {
            fs.rmSync(directoryPath, { recursive: true, force: true });
        }
    } catch (err) {
        log.warn(`No se pudo borrar el directorio temporal: ${directoryPath}`, err);
    }
};

const clearTemporaryDataPreservingCookies = async (userDataPath) => {
    const tempPaths = [
        'Cache',
        'GPUCache',
        'Code Cache',
        'Cached Data',
        'Service Worker',
        'Session Storage'
    ].map((name) => path.join(userDataPath, name));

    tempPaths.forEach(clearDirectory);

    if (mainView && mainView.webContents && mainView.webContents.session) {
        try {
            await mainView.webContents.session.clearCache();
            await mainView.webContents.session.clearStorageData({
                storages: [
                    'appcache',
                    'serviceworkers',
                    'cachestorage',
                    'indexdb',
                    'localstorage',
                    'filesystem',
                    'shadercache'
                ]
            });
        } catch (err) {
            log.warn('Error al limpiar datos temporales de la sesion.', err);
        }
    }
};

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: `Recursos Digitales SEA v${app.getVersion()}`,
        autoHideMenuBar: true,
        show: false,
        icon: path.join(__dirname, 'ico.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    Menu.setApplicationMenu(null);
    mainWindow.loadFile('navbar.html', {
        query: {
            version: app.getVersion()
        }
    });

    mainView = new WebContentsView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            allowRunningInsecureContent: false,
            devTools: !app.isPackaged
        }
    });

    mainWindow.contentView.addChildView(mainView);

    const resizeView = () => {
        const bounds = mainWindow.getContentBounds();
        mainView.setBounds({
            x: 0,
            y: 50,
            width: bounds.width,
            height: Math.max(0, bounds.height - 50)
        });
    };

    mainWindow.on('resize', resizeView);

    mainWindow.once('ready-to-show', () => {
        resizeView();
        mainWindow.show();
    });

    let config = readSavedConfig(getSafeAppUrl(DEFAULT_URL));
    let urlToLoad = config.lastUrl;
    let shouldClearTemp = false;
    currentUrl = urlToLoad;

    if (config.lastVersion && config.lastVersion !== app.getVersion()) {
        shouldClearTemp = true;
    }

    if (shouldClearTemp) {
        await clearTemporaryDataPreservingCookies(app.getPath('userData'));
        config.lastVersion = app.getVersion();
        writeSavedConfig(config);
    }

    loadAllowedUrl(urlToLoad);

    const saveUrl = (url) => {
        if (!isAllowedUrl(url)) {
            log.warn(`No se guardÃ³ URL no permitida: ${url}`);
            return;
        }

        currentUrl = url;
        sendNavigationState(url);
        config.lastUrl = url;
        config.lastVersion = app.getVersion();
        writeSavedConfig(config);
    };

    const updateNavbarThemeColor = async () => {
        const script = `(function () {
            const normalize = value => value && value.trim ? value.trim() : value;
            const isTransparent = color => !color || /^(transparent|rgba\\(0, ?0, ?0, ?0\\)|hsla\\(0, ?0%, ?0%, ?0\\))$/i.test(color);

            const headerSelectors = ['header', 'main header', 'article header', '.page-header', '.site-header', '#header', '.header', 'nav'];
            for (const selector of headerSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    const bg = window.getComputedStyle(element).backgroundColor;
                    if (!isTransparent(bg)) return normalize(bg);
                }
            }

            const themeMeta = document.querySelector('meta[name="theme-color"]');
            if (themeMeta && themeMeta.content) {
                return normalize(themeMeta.content);
            }

            const bodyBg = window.getComputedStyle(document.body).backgroundColor;
            if (!isTransparent(bodyBg)) return normalize(bodyBg);

            const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
            if (!isTransparent(htmlBg)) return normalize(htmlBg);

            return '#387c92';
        })();`;

        try {
            const color = await mainView.webContents.executeJavaScript(script, true) || '#387c92';
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('navbar-theme-color', color);
            }
        } catch (err) {
            log.warn('No se pudo determinar el color de encabezado de la pÃ¡gina activa.', err);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('navbar-theme-color', '#387c92');
            }
        }
    };

    mainView.webContents.on('did-navigate', (_event, url) => {
        saveUrl(url);
        updateNavbarThemeColor();
    });
    mainView.webContents.on('did-navigate-in-page', (_event, url) => {
        saveUrl(url);
        updateNavbarThemeColor();
    });

    mainView.webContents.on('did-finish-load', () => {
        updateNavbarThemeColor();
    });

    mainView.webContents.on('will-navigate', (event, url) => {
        if (!isAllowedUrl(url)) {
            event.preventDefault();
            log.warn(`NavegaciÃ³n bloqueada: ${url}`);
        }
    });

    mainView.webContents.setWindowOpenHandler(({ url }) => {
        loadAllowedUrl(url);
        return { action: 'deny' };
    });

    const checkForUpdatesManually = async () => {
        if (updateReadyToInstall) {
            return {
                status: 'downloaded',
                message: 'Actualización lista para instalar.',
                canRestart: true
            };
        }

        if (!app.isPackaged) {
            return {
                status: 'disabled',
                message: 'La revisión de actualizaciones solo funciona en la app instalada.'
            };
        }

        if (manualUpdateCheckInProgress || automaticUpdateCheckInProgress) {
            return {
                status: 'checking',
                message: 'Ya se están buscando actualizaciones.'
            };
        }

        manualUpdateCheckInProgress = true;
        sendUpdateStatus({
            status: 'checking',
            message: 'Buscando actualizaciones...'
        });

        try {
            await autoUpdater.checkForUpdates();
            return {
                status: 'checking',
                message: 'Revisión de actualizaciones iniciada.'
            };
        } catch (err) {
            manualUpdateCheckInProgress = false;
            log.error(`Error buscando actualizaciones manualmente: ${err == null ? 'unknown' : err.message}`);
            return {
                status: 'error',
                message: 'No se pudieron buscar actualizaciones.'
            };
        }
    };

    const openSupportWindow = () => {
        if (supportWindow) {
            supportWindow.focus();
            return;
        }

        supportWindow = new BrowserWindow({
            width: 650,
            height: 580,
            resizable: false,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            show: false,
            parent: mainWindow,
            modal: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                preload: path.join(__dirname, 'preload.js')
            }
        });

        supportWindow.loadFile('soporte.html');

        supportWindow.once('ready-to-show', () => {
            supportWindow.show();
        });

        supportWindow.on('closed', () => {
            supportWindow = null;
        });
    };

    const buildNavigationMenuItems = (items) => items.map((item) => ({
        label: item.label,
        type: 'normal',
        click: () => {
            currentUrl = item.url;
            loadAllowedUrl(item.url);
        }
    }));

    const installDownloadedUpdate = () => {
        const status = {
            status: 'installing',
            message: 'Instalando actualización... La aplicación se reiniciará sola.',
            canRestart: false
        };

        if (updateInstallInProgress) return status;

        if (!updateReadyToInstall) {
            return {
                status: 'idle',
                message: 'No hay una actualización lista para instalar.'
            };
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setProgressBar(2);
        }

        sendUpdateStatus(status);

        setTimeout(() => {
            try {
                runDownloadedUpdateInstaller();
            } catch (err) {
                updateInstallInProgress = false;
                updateReadyToInstall = true;
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.setProgressBar(-1);
                }
                log.error(`Error al instalar actualización: ${err == null ? 'unknown' : err.message}`);
                sendUpdateStatus({
                    status: 'error',
                    message: 'No se pudo iniciar la instalación.',
                    canRestart: true
                });
            }
        }, 1200);

        return status;
    };

    const openAppMenu = (groupId, point = {}) => {
        const menuTemplates = {
            recursos: buildNavigationMenuItems(APP_MENU_GROUPS.recursos),
            sistemas: buildNavigationMenuItems(APP_MENU_GROUPS.sistemas),
            soporte: [
                ...buildNavigationMenuItems(APP_MENU_GROUPS.soporte),
                { type: 'separator' },
                {
                    label: 'Abrir Soporte TI',
                    click: openSupportWindow
                }
            ],
            actualizacion: [
                {
                    label: 'Buscar actualización',
                    click: () => {
                        checkForUpdatesManually().then(sendUpdateStatus);
                    }
                },
                {
                    label: 'Reiniciar y actualizar',
                    enabled: updateReadyToInstall && !updateInstallInProgress,
                    click: installDownloadedUpdate
                }
            ]
        };

        const template = menuTemplates[groupId];
        if (!template) return;

        Menu.buildFromTemplate(template).popup({
            window: mainWindow,
            x: Math.max(0, Math.round(Number(point.x) || 0)),
            y: 50
        });
    };

    ipcMain.removeAllListeners('navigate');
    ipcMain.on('navigate', (_event, url) => {
        loadAllowedUrl(url);
    });

    ipcMain.removeAllListeners('reload');
    ipcMain.on('reload', () => {
        mainView.webContents.reload();
    });

    ipcMain.removeHandler('get-last-url');
    ipcMain.handle('get-last-url', () => {
        return readSavedConfig(getSafeAppUrl(DEFAULT_URL)).lastUrl;
    });

    ipcMain.removeHandler('get-app-version');
    ipcMain.handle('get-app-version', () => {
        return app.getVersion();
    });

    ipcMain.removeHandler('check-for-updates');
    ipcMain.handle('check-for-updates', async () => {
        return checkForUpdatesManually();
    });

    ipcMain.removeHandler('restart-and-update');
    ipcMain.handle('restart-and-update', () => {
        return installDownloadedUpdate();
    });

    ipcMain.removeAllListeners('open-app-menu');
    ipcMain.on('open-app-menu', (_event, groupId, point) => {
        openAppMenu(groupId, point);
    });

    ipcMain.removeAllListeners('open-ti-support');
    ipcMain.on('open-ti-support', () => {
        openSupportWindow();
    });

    ipcMain.removeAllListeners('close-support');
    ipcMain.on('close-support', () => {
        if (supportWindow) {
            supportWindow.close();
        }
    });

    ipcMain.removeAllListeners('open-external');
    ipcMain.on('open-external', (_event, url) => {
        if (!isAllowedExternalUrl(url)) {
            log.warn(`Enlace externo bloqueado: ${url}`);
            return;
        }

        shell.openExternal(url);
    });
}

app.whenReady().then(async () => {
    await createWindow();

    if (app.isPackaged) {
        const updateCheckIntervalMinutes = getUpdateCheckIntervalMinutes();
        log.info(`Aplicación empaquetada. Verificando updates cada ${updateCheckIntervalMinutes} minutos...`);
        checkForUpdatesAutomatically();

        setInterval(
            checkForUpdatesAutomatically,
            updateCheckIntervalMinutes * 60 * 1000
        );
    } else {
        log.info('Modo desarrollo. AutoUpdater desactivado.');
    }
});

app.on('window-all-closed', () => {
    if (runDownloadedUpdateInstaller()) return;

    app.quit();
});

app.on('before-quit', (event) => {
    if (updateReadyToInstall && !updateInstallInProgress) {
        event.preventDefault();
        runDownloadedUpdateInstaller();
    }
});

app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event, url) => {
        if (!isAllowedUrl(url)) {
            event.preventDefault();
            log.warn(`[web-contents-created] NavegaciÃ³n bloqueada: ${url}`);
        }
    });

    contents.setWindowOpenHandler(({ url }) => {
        if (!isAllowedUrl(url)) {
            log.warn(`[web-contents-created] Popup bloqueado: ${url}`);
            return { action: 'deny' };
        }

        return { action: 'allow' };
    });
});

autoUpdater.on('checking-for-update', () => {
    log.info('Verificando actualizaciones...');
});

autoUpdater.on('update-available', (info) => {
    updateReadyToInstall = false;
    updateInstallInProgress = false;
    log.info(`Actualización disponible: v${info.version}`);
    sendUpdateStatus({
        status: 'available',
        message: `Actualización ${info.version} encontrada. Descargando...`,
        canRestart: false
    });
});

autoUpdater.on('update-not-available', () => {
    const wasManualCheck = manualUpdateCheckInProgress;

    updateReadyToInstall = false;
    updateInstallInProgress = false;
    log.info('La aplicación está actualizada.');
    manualUpdateCheckInProgress = false;
    automaticUpdateCheckInProgress = false;

    if (wasManualCheck) {
        sendUpdateStatus({
            status: 'current',
            message: 'Ya tienes la versión más reciente.',
            canRestart: false
        });
    }
});

autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    log.info(`Descargando actualización: ${percent}%`);
    if (mainWindow) {
        mainWindow.setProgressBar(progress.percent / 100);
    }
    sendUpdateStatus({
        status: 'downloading',
        message: `Descargando actualización: ${percent}%`,
        canRestart: false
    });
});

autoUpdater.on('update-downloaded', (info) => {
    log.info(`Actualización descargada: v${info.version}`);
    manualUpdateCheckInProgress = false;
    automaticUpdateCheckInProgress = false;
    updateReadyToInstall = true;
    updateInstallInProgress = false;
    if (mainWindow) {
        mainWindow.setProgressBar(-1);
    }
    log.info('La actualización está lista para reiniciar e instalar.');
    showUpdateReadyNotification(info);
    sendUpdateStatus({
        status: 'downloaded',
        message: `Actualización ${info.version} lista.`,
        canRestart: true
    });
});

autoUpdater.on('error', (err) => {
    const wasManualCheck = manualUpdateCheckInProgress;

    manualUpdateCheckInProgress = false;
    automaticUpdateCheckInProgress = false;
    updateReadyToInstall = false;
    updateInstallInProgress = false;
    log.error(`Error en AutoUpdater: ${err == null ? 'unknown' : err.message}`);

    if (wasManualCheck) {
        sendUpdateStatus({
            status: 'error',
            message: 'No se pudieron buscar actualizaciones.',
            canRestart: false
        });
    }
});
