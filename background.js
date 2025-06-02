// background.js - Service Worker pour l'extension Consent Watcher
chrome.runtime.onInstalled.addListener(() => {
    console.log('Consent Watcher extension installée');
    
    // Initialiser la configuration par défaut
    chrome.storage.local.set({
        selectedAI: 'openai',
        selectedModel: 'gpt-4',
        apiKeys: {}
    });
});

// Écouter les messages du content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message reçu dans background:', request);

    if (request.action === 'apiCall') {
        handleApiCall(request, sendResponse);
        return true; // Indique une réponse asynchrone
    }
});

// Fonction pour gérer les appels API
async function handleApiCall(request, sendResponse) {
    const { aiService, body, apiKey } = request;
    
    if (!apiKey) {
        sendResponse({ error: 'Clé API manquante' });
        return;
    }

    try {
        const response = await makeApiRequest(aiService, body, apiKey);
        sendResponse(response);
    } catch (error) {
        console.error('Erreur API:', error);
        sendResponse({ error: error.message });
    }
}

// Fonction pour effectuer les requêtes API
async function makeApiRequest(aiService, body, apiKey) {
    const endpoints = {
        openai: 'https://api.openai.com/v1/chat/completions',
        claude: 'https://api.anthropic.com/v1/messages',
        gemini: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        grok: 'https://api.x.ai/v1/chat/completions'
    };

    const headers = {
        'Content-Type': 'application/json'
    };

    // Configuration des headers selon l'IA
    switch (aiService) {
        case 'openai':
            headers['Authorization'] = `Bearer ${apiKey}`;
            break;
        case 'claude':
            headers['Authorization'] = `Bearer ${apiKey}`;
            headers['anthropic-version'] = '2023-06-01';
            break;
        case 'gemini':
            // Pour Gemini, la clé API est dans l'URL
            break;
        case 'grok':
            headers['Authorization'] = `Bearer ${apiKey}`;
            break;
    }

    console.log(`Appel API vers ${aiService}:`, {
        url: endpoints[aiService],
        headers: Object.keys(headers),
        bodyLength: body.length
    });

    const response = await fetch(endpoints[aiService], {
        method: 'POST',
        headers: headers,
        body: body
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Erreur ${response.status}:`, errorText);
        
        // Messages d'erreur personnalisés selon le code de statut
        switch (response.status) {
            case 401:
                throw new Error('Clé API invalide ou expirée');
            case 403:
                throw new Error('Accès refusé - vérifiez vos permissions API');
            case 429:
                throw new Error('Limite de taux dépassée - attendez un moment');
            case 500:
                throw new Error('Erreur serveur de l\'IA - réessayez plus tard');
            default:
                throw new Error(`Erreur ${response.status}: ${errorText}`);
        }
    }

    const data = await response.json();
    console.log('Réponse API reçue:', data);
    
    return data;
}

// Gérer les erreurs non capturées
self.addEventListener('error', (event) => {
    console.error('Erreur dans le service worker:', event.error);
});

// Gérer les promesses rejetées
self.addEventListener('unhandledrejection', (event) => {
    console.error('Promesse rejetée dans le service worker:', event.reason);
});

// Fonction utilitaire pour nettoyer les données de stockage
chrome.runtime.onSuspend.addListener(() => {
    console.log('Service worker suspendu');
});

// Écouter les changements de stockage pour la synchronisation
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        console.log('Configuration mise à jour:', changes);
    }
});

// Fonction pour valider les clés API (optionnel)
async function validateApiKey(aiService, apiKey) {
    const testEndpoints = {
        openai: 'https://api.openai.com/v1/models',
        claude: 'https://api.anthropic.com/v1/messages',
        gemini: `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        grok: 'https://api.x.ai/v1/models'
    };

    try {
        const headers = { 'Authorization': `Bearer ${apiKey}` };
        if (aiService === 'claude') {
            headers['anthropic-version'] = '2023-06-01';
        }

        const response = await fetch(testEndpoints[aiService], {
            method: 'GET',
            headers: aiService === 'gemini' ? {} : headers
        });

        return response.ok;
    } catch (error) {
        console.error('Erreur validation clé API:', error);
        return false;
    }
}

// Exposer la fonction de validation si nécessaire
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'validateApiKey') {
        validateApiKey(request.aiService, request.apiKey)
            .then(isValid => sendResponse({ isValid }))
            .catch(error => sendResponse({ isValid: false, error: error.message }));
        return true;
    }
});
