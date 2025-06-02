document.addEventListener('DOMContentLoaded', function () {
  const aiSelect = document.getElementById('ai-select');
  const modelInput = document.getElementById('model-input');
  const apiKeyInput = document.getElementById('api-key');
  const confirmBtn = document.getElementById('confirm-btn');
  const status = document.getElementById('status');

  // Charger les paramètres sauvegardés au démarrage
  function loadSavedSettings() {
    chrome.storage.local.get(['selectedAI', 'selectedModel', 'apiKeys'], (result) => {
      // Charger l'IA sélectionnée
      if (result.selectedAI) {
        aiSelect.value = result.selectedAI;
        updatePlaceholder();
      }

      // Charger le modèle sélectionné
      if (result.selectedModel) {
        modelInput.value = result.selectedModel;
      }

      // Charger la clé API correspondante
      if (result.apiKeys && result.selectedAI && result.apiKeys[result.selectedAI]) {
        apiKeyInput.value = result.apiKeys[result.selectedAI];
      } else {
        // Migration depuis l'ancien format (pour compatibilité)
        chrome.storage.local.get(['openai_api_key'], (oldResult) => {
          if (oldResult.openai_api_key && aiSelect.value === 'openai') {
            apiKeyInput.value = oldResult.openai_api_key;
          }
        });
      }
    });
  }

  // Mettre à jour le placeholder selon l'IA sélectionnée
  function updatePlaceholder() {
    const selectedAI = aiSelect.value;
    const placeholders = {
      openai: 'ex: gpt-4o, gpt-4o-mini, gpt-3.5-turbo',
      claude: 'ex: claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022',
      gemini: 'ex: gemini-1.5-pro, gemini-1.5-flash, gemini-pro',
      grok: 'ex: grok-beta, grok-vision-beta'
    };

    modelInput.placeholder = placeholders[selectedAI] || 'Nom du modèle';

    // Charger la clé API correspondante à la nouvelle IA
    chrome.storage.local.get(['apiKeys'], (result) => {
      if (result.apiKeys && result.apiKeys[selectedAI]) {
        apiKeyInput.value = result.apiKeys[selectedAI];
      } else {
        apiKeyInput.value = '';
      }
    });
  }

  // Valider le format de la clé API selon le service
  function validateApiKey(aiService, apiKey) {
    switch (aiService) {
      case 'openai':
        return apiKey.startsWith('sk-');
      case 'claude':
        return apiKey.startsWith('sk-ant-');
      case 'gemini':
        return apiKey.length > 30; // Gemini keys are typically longer
      case 'grok':
        return apiKey.startsWith('xai-');
      default:
        return apiKey.length > 10;
    }
  }

  // Gérer le changement d'IA
  aiSelect.addEventListener('change', updatePlaceholder);

  // Gérer la confirmation et sauvegarde des paramètres
  confirmBtn.addEventListener('click', function () {
    const selectedAI = aiSelect.value;
    const selectedModel = modelInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!selectedModel) {
      showStatus('❌ Veuillez saisir le nom du modèle', '#ff6b6b');
      return;
    }

    if (!apiKey) {
      showStatus('❌ Veuillez saisir une clé API', '#ff6b6b');
      return;
    }

    if (!validateApiKey(selectedAI, apiKey)) {
      showStatus(`❌ Format de clé API invalide pour ${selectedAI}`, '#ff6b6b');
      return;
    }

    // Désactiver le bouton pendant la sauvegarde
    confirmBtn.disabled = true;
    confirmBtn.textContent = '💾 Sauvegarde...';

    // Charger les clés existantes et ajouter/mettre à jour la nouvelle
    chrome.storage.local.get(['apiKeys'], (result) => {
      const apiKeys = result.apiKeys || {};
      apiKeys[selectedAI] = apiKey;

      // Sauvegarder tous les paramètres
      chrome.storage.local.set({
        selectedAI: selectedAI,
        selectedModel: selectedModel,
        apiKeys: apiKeys
      }, () => {
        // Réactiver le bouton
        confirmBtn.disabled = false;
        confirmBtn.textContent = '💾 Confirmer et Enregistrer';

        if (chrome.runtime.lastError) {
          console.error('Erreur lors de la sauvegarde:', chrome.runtime.lastError);
          showStatus('❌ Erreur lors de la sauvegarde', '#ff6b6b');
        } else {
          showStatus('✅ Configuration sauvegardée avec succès!', '#51cf66');

          // Cacher le message après 3 secondes
          setTimeout(() => {
            status.innerHTML = '';
          }, 3000);
        }
      });
    });
  });

  // Fonction utilitaire pour afficher les messages de statut
  function showStatus(message, color) {
    status.textContent = message;
    status.style.color = color;
  }

  // Initialisation
  loadSavedSettings();
  updatePlaceholder();
});
