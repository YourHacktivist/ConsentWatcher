(function () {
    'use strict';

    let analysisPopup = null;
    let isDragging = false;
    let offsetX, offsetY;
    const primaryColor = '#4361ee';
    const primaryLightColor = '#4cc9f0';
    const textColor = '#212121';
    const cardBackgroundColor = '#fff';
    const boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
    const borderRadius = '8px';
    const fontFamily = 'Roboto, sans-serif';

    // Variables pour stocker la configuration
    let currentConfig = {
        selectedAI: 'openai',
        selectedModel: 'gpt-4',
        apiKey: ''
    };

    function Showerror(errormessage) {
        const errorPopup = document.createElement('div');
        errorPopup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ff4444;
        color: white;
        padding: 20px;
        border-radius: 10px;
        z-index: 99999;
        max-width: 400px;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;

        // Create elements safely without innerHTML
        const title = document.createElement('h3');
        title.style.cssText = 'margin: 0 0 15px 0;';
        title.textContent = 'Analysis error'; // Safe text assignment

        const message = document.createElement('p');
        message.style.cssText = 'margin: 0 0 20px 0;';
        message.textContent = errormessage; // Safe text assignment - prevents XSS

        const closeBtn = document.createElement('button');
        closeBtn.id = 'closeErrorBtn';
        closeBtn.style.cssText = `
        background: white;
        color: #ff4444;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
        transition: background-color 0.2s;
    `;
        closeBtn.textContent = 'Fermer'; // Safe text assignment

        // Append elements to popup
        errorPopup.appendChild(title);
        errorPopup.appendChild(message);
        errorPopup.appendChild(closeBtn);

        document.body.appendChild(errorPopup);

        // Event listeners
        closeBtn.addEventListener('click', function () {
            errorPopup.remove();
        });

        // Hover effects
        closeBtn.addEventListener('mouseenter', function () {
            this.style.backgroundColor = '#f0f0f0';
        });

        closeBtn.addEventListener('mouseleave', function () {
            this.style.backgroundColor = 'white';
        });

        // Auto-close after 10 seconds
        setTimeout(() => {
            if (document.body.contains(errorPopup)) {
                errorPopup.remove();
            }
        }, 10000);
    }

    // Charger la configuration depuis le storage
    function loadConfig() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['selectedAI', 'selectedModel', 'apiKeys'], (result) => {
                console.log('Configuration loaded:', result); // Debug
                if (result.selectedAI && result.selectedModel && result.apiKeys) {
                    currentConfig = {
                        selectedAI: result.selectedAI,
                        selectedModel: result.selectedModel,
                        apiKey: result.apiKeys[result.selectedAI] || ''
                    };
                }
                console.log('Current config:', currentConfig); // Debug
                resolve(currentConfig);
            });
        });
    }

    // Create a button to trigger the analysis
    function createActionButton() {
        const button = document.createElement('button');
        button.textContent = 'Analyze Privacy Policy';
        button.style.position = 'fixed';
        button.style.bottom = '20px';
        button.style.left = '20px';
        button.style.backgroundColor = primaryColor;
        button.style.color = 'white';
        button.style.padding = '12px 20px';
        button.style.border = 'none';
        button.style.borderRadius = borderRadius;
        button.style.cursor = 'pointer';
        button.style.fontSize = '16px';
        button.style.fontFamily = fontFamily;
        button.style.boxShadow = boxShadow;
        button.style.zIndex = '10000';

        button.addEventListener('mouseover', () => button.style.backgroundColor = primaryLightColor);
        button.addEventListener('mouseout', () => button.style.backgroundColor = primaryColor);
        button.addEventListener('click', async (e) => {
            // Charger la config et lancer l'analyse
            await loadConfig();
            runAnalysis();
        });

        document.body.appendChild(button);
    }

    // Créer le payload selon l'IA sélectionnée
    function createApiPayload(prompt, aiService, model) {
        switch (aiService) {
            case 'openai':
                return {
                    model: model,
                    messages: [{
                        role: "user",
                        content: prompt
                    }],
                    temperature: 0.3,
                    max_tokens: 4000
                };

            case 'claude':
                return {
                    model: model,
                    max_tokens: 4000,
                    messages: [{
                        role: "user",
                        content: prompt
                    }],
                    temperature: 0.3
                };

            case 'gemini':
                return {
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 4000
                    }
                };

            case 'grok':
                return {
                    messages: [{
                        role: "user",
                        content: prompt
                    }],
                    model: model,
                    stream: false,
                    temperature: 0.3,
                    max_tokens: 4000
                };

            default:
                return {
                    model: model,
                    messages: [{
                        role: "user",
                        content: prompt
                    }],
                    temperature: 0.3,
                    max_tokens: 4000
                };
        }
    }

    // Extraire la réponse selon l'IA
    function extractResponse(response, aiService) {
        try {
            console.log('Raw API response:', response); // Debug
            switch (aiService) {
                case 'openai':
                case 'grok':
                    return response.choices?.[0]?.message?.content || 'Error during analysis.';
                case 'claude':
                    return response.content?.[0]?.text || 'Error during analysis.';
                case 'gemini':
                    return response.candidates?.[0]?.content?.parts?.[0]?.text || 'Error during analysis.';
                default:
                    return response.choices?.[0]?.message?.content || 'Error during analysis.';
            }
        } catch (error) {
            console.error('Error extracting response:', error);
            return 'Error analyzing response.';
        }
    }

    // Function to analyze the privacy policy using selected AI API
    async function analyzePolicy(text) {
        console.log('Début de l\'analyse avec la config:', currentConfig); // Debug

        if (!currentConfig.apiKey) {
            console.error('Clé API manquante'); // Debug
            return 'Erreur: Clé API non configurée. Veuillez configurer votre clé API dans les paramètres de l\'extension.';
        }

        const prompt = `
You are a privacy assistant. Analyze the following text and try to extract privacy-related information.

ONLY respond with "NOT_PRIVACY_POLICY" if the text is clearly unrelated to privacy (like a product page, contact page, or completely different content) AND contains absolutely no privacy information.

Be flexible and accommodating - if you find ANY privacy-related content (even if incomplete), provide an analysis. This includes:
- Partial privacy policies
- Pages with some privacy information mixed with other content  
- Cookie notices or privacy banners
- Terms that mention data handling
- Any mention of data collection, cookies, or user information

If you find any privacy-related content, analyze it and provide detailed but concise answers to these questions, making sure each point starts on a new line with the right number without the question :
1. What types of personal data are collected? (e.g., name, email, browsing history) - Include specific examples and explain how this data is gathered. If unclear, state "Information not clearly specified in the available text."
2. Is personal data shared with third parties? If yes, with whom and for what purpose? - Specify the types of partners and the reasons for sharing. If unclear, state "Third-party sharing details not clearly specified."
3. Are cookies or other tracking technologies used? If yes, for what purposes? - Explain the different types of tracking and their specific uses. If unclear, state "Cookie usage details not clearly specified."
4. What rights do users have regarding their data? (e.g., access, deletion, rectification) - Detail the process for exercising these rights and any limitations. If unclear, state "User rights not clearly specified."
5. IMPORTANT - Provide a numerical score from 0 to 10 (where 10 is fully compliant and trustworthy). Format: Score: X/10 with a brief explanation covering transparency, user control, and compliance with privacy regulations.
6. Provide one key practical privacy advice for the user of this website - Give actionable guidance specific to this privacy policy.
IMPORTANT: For the score (point 5), respond EXACTLY in this format: "Score: X/10" where X is a number from 0 to 10.
Format your response with simple text, no markdown formatting. Make sure each numbered point starts on a new line.
`;

        const policyContent = `
Text to analyze:
"""${text.slice(0, 8000)}"""
`;

        const fullPrompt = prompt + policyContent;
        const payload = createApiPayload(fullPrompt, currentConfig.selectedAI, currentConfig.selectedModel);

        console.log('Payload envoyé:', payload); // Debug

        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'apiCall',
                aiService: currentConfig.selectedAI,
                body: JSON.stringify(payload),
                apiKey: currentConfig.apiKey
            }, (response) => {
                console.log('Response received from background:', response); // Debug
                if (chrome.runtime.lastError) {
                    console.error('Runtime error:', chrome.runtime.lastError);
                    resolve('Communication error with extension.');
                    return;
                }
                if (!response) {
                    console.error('No response from background script');
                    resolve('Error: No response from server.');
                    return;
                }
                if (response.error) {
                    console.error('API error:', response.error);
                    resolve(`API Error: ${response.error}`);
                    return;
                }
                const result = extractResponse(response, currentConfig.selectedAI);
                console.log('Extracted result:', result); // Debug
                resolve(result);
            });
        });
    }


    // Function to extract visible text from the page
    function extractVisibleText() {
        const elements = Array.from(document.body.querySelectorAll('p, div, span, li, h1, h2, h3, h4, h5, h6'));
        const visibleText = elements
            .filter(el => {
                // Vérifier si l'élément est visible
                const style = window.getComputedStyle(el);
                return el.offsetParent !== null &&
                    style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    style.opacity !== '0';
            })
            .map(el => el.innerText ? el.innerText.trim() : '')
            .filter(text => text.length > 20) // Filtrer les textes trop courts
            .join(' ');

        console.log('Texte visible extrait:', visibleText.slice(0, 300) + '...'); // Debug
        return visibleText;
    }

    // Function to show a loading popup while analyzing
    function showLoadingPopup() {
        if (analysisPopup) {
            analysisPopup.remove();
        }

        analysisPopup = document.createElement('div');
        analysisPopup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1B1212;
            border: 1px solid ${primaryLightColor};
            padding: 40px 30px;
            z-index: 99999;
            border-radius: 16px;
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.1);
            font-family: 'Inter', sans-serif;
            color: ${primaryColor};
            text-align: center;
            min-width: 320px;
            transition: opacity 0.4s ease;
        `;

        const title = document.createElement('div');
        title.style.fontSize = '20px';
        title.style.fontWeight = '600';
        title.textContent = 'Consent Watcher is scanning...';
        analysisPopup.appendChild(title);

        const subtitle = document.createElement('div');
        subtitle.style.marginTop = '8px';
        subtitle.style.fontSize = '14px';
        subtitle.style.color = '#8d99ae';
        subtitle.textContent = `Analyzing with ${currentConfig.selectedAI.toUpperCase()} - ${currentConfig.selectedModel}`;
        analysisPopup.appendChild(subtitle);

        // Animation de chargement
        const spinner = document.createElement('div');
        spinner.style.cssText = `
            margin: 30px auto 0;
            width: 40px;
            height: 40px;
            border: 4px solid ${primaryLightColor};
            border-radius: 50%;
            border-top-color: ${primaryColor};
            animation: spin 1s ease-in-out infinite;
        `;
        analysisPopup.appendChild(spinner);

        document.body.appendChild(analysisPopup);

        // Ajouter l'animation CSS
        if (!document.getElementById('loading-styles')) {
            const style = document.createElement('style');
            style.id = 'loading-styles';
            style.textContent = `
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Fonction pour parser la réponse GPT
    function parseGPTResponse(text) {
        const sections = {
            dataCollection: '',
            dataSharing: '',
            tracking: '',
            userRights: '',
            gdprScore: '',
            privacyAdvice: '',
        };

        // Nettoyer le texte des astérisques et formatage markdown
        const cleanText = text.replace(/\*\*/g, '').replace(/\*/g, '');

        // Essayer différents patterns de regex sans les formatages gras
        const patterns = [
            {
                dataCollection: /1\.\s*(?:Data Collection\s*:)?\s*(.*?)(?=2\.|$)/s,
                dataSharing: /2\.\s*(?:Data Sharing\s*:)?\s*(.*?)(?=3\.|$)/s,
                tracking: /3\.\s*(?:Tracking\s*:)?\s*(.*?)(?=4\.|$)/s,
                userRights: /4\.\s*(?:User Rights\s*:)?\s*(.*?)(?=5\.|$)/s,
                gdprScore: /5\.\s*(?:GDPR Score\s*:)?\s*(.*?)(?=6\.|$)/s,
                privacyAdvice: /6\.\s*(?:Privacy Advice\s*:)?\s*(.*?)$/s,
            },
            {
                dataCollection: /1\.(.*?)(?=2\.|$)/s,
                dataSharing: /2\.(.*?)(?=3\.|$)/s,
                tracking: /3\.(.*?)(?=4\.|$)/s,
                userRights: /4\.(.*?)(?=5\.|$)/s,
                gdprScore: /5\.(.*?)(?=6\.|$)/s,
                privacyAdvice: /6\.(.*?)$/s,
            }
        ];

        for (const pattern of patterns) {
            for (const [key, regex] of Object.entries(pattern)) {
                if (!sections[key]) {
                    const match = cleanText.match(regex);
                    if (match && match[1]) {
                        sections[key] = match[1].trim().replace(/^-\s*/, '');
                    }
                }
            }
        }

        if (!sections.gdprScore || sections.gdprScore.length < 3) {
            // Chercher des patterns de score plus spécifiques
            const scorePatterns = [
                /Score\s*:?\s*(\d+)(?:\/10)?/i,
                /(\d+)\/10/,
                /Score.*?(\d+)/i,
                /Note.*?(\d+)/i,
                /Rating.*?(\d+)/i,
                /Évaluation.*?(\d+)/i,
                /Confiance.*?(\d+)/i,
                /Trust.*?(\d+)/i
            ];

            for (const scorePattern of scorePatterns) {
                const scoreMatch = cleanText.match(scorePattern)
                if (scoreMatch && scoreMatch[1]) {
                    const score = parseInt(scoreMatch[1]);
                    if (score >= 0 && score <= 10) {
                        sections.gdprScore = `Score: ${score}/10`;
                        break;
                    }
                }
            }
        }

        console.log('Sections parsées:', sections); // Debug
        return sections;
    }




    // Function to show the analysis result in a popup
    async function showAnalysisPopup(gptResponseText) {
        console.log('Affichage du popup avec:', gptResponseText); // Debug

        if (analysisPopup) analysisPopup.remove();

        if (!gptResponseText || gptResponseText.includes('Erreur')) {
            // Afficher l'erreur
            Showerror(gptResponseText);
            return 0;
        }

        // Cookie blocking function
        function deleteAllCookies() {
            const cookies = document.cookie.split(";");
            for (let cookie of cookies) {
                const eqPos = cookie.indexOf("=");
                const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
                document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
                document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + location.hostname;
            }
        }

        // Confirmation message function
        function showConfirmation(message) {
            const confirmation = document.createElement('div');
            confirmation.textContent = message;
            confirmation.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #22c55e;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 100000;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
            document.body.appendChild(confirmation);
            setTimeout(() => confirmation.remove(), 3000);
        }

        const parsed = parseGPTResponse(gptResponseText);

        const sections = [
            { icon: '📥', label: 'Collected data', key: 'dataCollection' },
            { icon: '🔄', label: 'Data sharing', key: 'dataSharing' },
            { icon: '🍪', label: 'Tracking', key: 'tracking' },
            { icon: '🧑‍⚖️', label: 'User rights', key: 'userRights' },
            { icon: '📊', label: 'GDPR score', key: 'gdprScore' },
            { icon: '💡', label: 'Privacy advice', key: 'privacyAdvice' },
            { icon: '📚', label: 'Resources', key: 'resources' }
        ];

        const container = document.createElement('div');
        container.style.cssText = `
        position: fixed;
        top: 60px;
        left: 60px;
        width: 760px;
        height: 520px;
        display: flex;
        background: #181818;
        border-radius: 18px;
        box-shadow: 0 18px 36px rgba(0,0,0,0.35);
        backdrop-filter: blur(14px);
        z-index: 99999;
        overflow: hidden;
        font-family: system-ui, sans-serif;
    `;

        // Rendre le popup déplaçable
        let isDragging = false, offsetX, offsetY;
        container.addEventListener('mousedown', (e) => {
            if (e.target === container || e.target.closest('.sidebar')) {
                isDragging = true;
                offsetX = e.clientX - container.getBoundingClientRect().left;
                offsetY = e.clientY - container.getBoundingClientRect().top;
                container.style.cursor = 'grabbing';
            }
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            container.style.left = `${e.clientX - offsetX}px`;
            container.style.top = `${e.clientY - offsetY}px`;
        });
        document.addEventListener('mouseup', () => {
            isDragging = false;
            container.style.cursor = 'default';
        });

        const sidebar = document.createElement('div');
        sidebar.className = 'sidebar';
        sidebar.style.cssText = `
        width: 190px;
        background: #121212;
        border-right: 1px solid #303030;
        display: flex;
        color: #fff;
        flex-direction: column;
        padding: 10px;
    `;

        const contentArea = document.createElement('div');
        contentArea.style.cssText = `
        flex: 1;
        padding: 25px;
        overflow-y: auto;
        font-size: 15px;
        color: #e2e8f0;
        line-height: 1.7;
        position: relative;
    `;

        const exportBtn = document.createElement('button');
        exportBtn.textContent = '📄 Export HTML';
        exportBtn.style.cssText = `
        position: absolute;
        bottom: 20px;
        right: 25px;
        background: #4361ee;
        color: white;
        padding: 10px 16px;
        font-size: 14px;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        transition: background 0.2s ease;
    `;
        exportBtn.addEventListener('mouseover', () => exportBtn.style.background = '#4cc9f0');
        exportBtn.addEventListener('mouseout', () => exportBtn.style.background = '#4361ee');
        exportBtn.addEventListener('click', () => generateHTMLReport(gptResponseText));

        // Fonction pour extraire et formater le score GDPR
        function extractGDPRScore(gdprText) {
            const scoreMatch = gdprText.match(/Score\s*:?\s*(\d+)(?:\/10)?/i) ||
                gdprText.match(/(\d+)\/10/) ||
                gdprText.match(/Score.*?(\d+)/i);

            if (scoreMatch && scoreMatch[1]) {
                const score = parseInt(scoreMatch[1]);
                if (score >= 0 && score <= 10) {
                    return score;
                }
            }
            return null;
        }

        // Fonction pour obtenir la couleur selon le score
        function getScoreColor(score) {
            if (score === null) return '#6b7280';
            if (score >= 8) return '#10b981'; // Vert
            if (score >= 6) return '#f59e0b'; // Orange
            if (score >= 4) return '#f97316'; // Orange foncé
            return '#ef4444'; // Rouge
        }

        // Fonction pour obtenir le texte d'évaluation
        function getScoreText(score) {
            if (score === null) return 'Not evaluated';
            if (score >= 8) return 'Excellent';
            if (score >= 6) return 'Good';
            if (score >= 4) return 'Concerning';
            return 'Dangerous';
        }

        function renderSection(key, label) {
            contentArea.innerHTML = `
        <h2 style="
            margin-top: 0;
            font-size: 20px;
            color: #fff;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 10px;
            margin-bottom: 20px;
        "></h2>
    `;
            // Safely set the text content
            contentArea.querySelector('h2').textContent = label;

            const content = parsed[key] || gptResponseText || 'Aucune information disponible';

            if (key === 'tracking') {
                // Section tracking avec bouton de blocage des cookies
                const toggleContainer = document.createElement('div');
                toggleContainer.style.cssText = `
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 25px;
                background: #242424;
                border: 1px solid #303030;
                border-radius: 12px;
                padding: 20px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            `;

                const labelEl = document.createElement('label');
                labelEl.textContent = '🔒 Block cookies';
                labelEl.style.cssText = `
                font-weight: bold;
                color: #e2e8f0;
                font-size: 16px;
            `;

                const toggle = document.createElement('input');
                toggle.type = 'checkbox';
                toggle.style.display = 'none';

                const customSwitch = document.createElement('span');
                customSwitch.style.cssText = `
                width: 42px;
                height: 24px;
                background: #ccc;
                border-radius: 12px;
                position: relative;
                display: inline-block;
                transition: background 0.3s;
                cursor: pointer;
            `;

                const knob = document.createElement('span');
                knob.style.cssText = `
                width: 20px;
                height: 20px;
                background: white;
                border-radius: 50%;
                position: absolute;
                top: 2px;
                left: 2px;
                transition: left 0.3s;
                box-shadow: 0 1px 4px rgba(0,0,0,0.2);
            `;

                customSwitch.appendChild(knob);
                customSwitch.addEventListener('click', () => {
                    toggle.checked = !toggle.checked;
                    if (toggle.checked) {
                        customSwitch.style.background = '#22c55e';
                        knob.style.left = '20px';
                        deleteAllCookies();
                        showConfirmation("Cookies blocked ✅");
                    } else {
                        customSwitch.style.background = '#ccc';
                        knob.style.left = '2px';
                    }
                });

                toggleContainer.appendChild(labelEl);
                toggleContainer.appendChild(customSwitch);
                contentArea.appendChild(toggleContainer);

                // Afficher le contenu de tracking
                const textBlock = document.createElement('div');
                textBlock.textContent = content;
                textBlock.style.cssText = `
                white-space: pre-wrap;
                background: #242424;
                border: 1px solid #303030;
                border-radius: 10px;
                padding: 18px;
                font-size: 15px;
                line-height: 1.75;
                color: #d1d5db;
                box-shadow: 0 2px 6px rgba(0,0,0,0.03);
                margin-bottom: 25px;
            `;
                contentArea.appendChild(textBlock);

            } else if (key === 'gdprScore') {
                // Rendu spécial pour le score GDPR
                const score = extractGDPRScore(content);
                const scoreColor = getScoreColor(score);
                const scoreText = getScoreText(score);
                const scoreContainer = document.createElement('div');
                scoreContainer.style.cssText = `
        background: #242424;
        border: 2px solid ${scoreColor};
        border-radius: 16px;
        padding: 30px;
        text-align: center;
        margin-bottom: 25px;
        box-shadow: 0 8px 20px rgba(0,0,0,0.15);
    `;

                const scoreDisplay = document.createElement('div');
                scoreDisplay.style.cssText = `
        font-size: 72px;
        font-weight: bold;
        color: ${scoreColor};
        margin-bottom: 15px;
        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    `;
                scoreDisplay.textContent = score !== null ? `${score}/10` : 'N/A';

                const scoreLabel = document.createElement('div');
                scoreLabel.style.cssText = `
        font-size: 24px;
        font-weight: 600;
        color: ${scoreColor};
        margin-bottom: 20px;
        text-transform: uppercase;
        letter-spacing: 1px;
    `;
                scoreLabel.textContent = scoreText;

                const scoreExplanation = document.createElement('div');
                scoreExplanation.style.cssText = `
        background: #1a1a1a;
        border-radius: 12px;
        padding: 20px;
        margin-top: 20px;
        border-left: 4px solid ${scoreColor};
    `;

                // Fonction de sanitisation simple
                function sanitizeHTML(str) {
                    const div = document.createElement('div');
                    div.textContent = str;
                    return div.innerHTML;
                }

                // Création sécurisée du contenu de l'explication
                const explanationTitle = document.createElement('h4');
                explanationTitle.style.cssText = 'color: #fff; margin: 0 0 12px 0; font-size: 16px;';
                explanationTitle.textContent = 'Explication du score :';

                const explanationParagraph = document.createElement('p');
                explanationParagraph.style.cssText = 'color: #d1d5db; margin: 0; line-height: 1.6; font-size: 15px;';

                const explanationText = content.replace(/Score\s*:?\s*\d+(?:\/10)?/i, '').trim();
                explanationParagraph.textContent = explanationText || 'Aucune explication disponible.';

                scoreExplanation.appendChild(explanationTitle);
                scoreExplanation.appendChild(explanationParagraph);

                scoreContainer.appendChild(scoreDisplay);
                scoreContainer.appendChild(scoreLabel);
                scoreContainer.appendChild(scoreExplanation);
                contentArea.appendChild(scoreContainer);


            } else if (key === 'resources') {
                // Section ressources spéciale
                const title = document.createElement('h2');
                title.textContent = '🔗 Additional resources';
                title.style.cssText = `
                margin-bottom: 16px;
                font-size: 17px;
                color: #e2e8f0;
                border-bottom: 1px solid #3e4c5e;
                padding-bottom: 8px;
            `;

                const grid = document.createElement('div');
                grid.style.cssText = `
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 16px;
            `;

                const links = [
                    { name: 'ShutUpTracker', url: 'https://shutuptrackers.com', desc: 'A crowdsourced directory of mobile apps that track users.' },
                    { name: 'Tails', url: 'https://tails.net/', desc: 'A live operating system focused on privacy and anonymity.' },
                    { name: 'PrivacyTools', url: 'https://www.privacytools.io/', desc: 'A curated list of privacy-focused tools and services.' },
                    { name: 'Privacy Badger', url: 'https://privacybadger.org/', desc: 'A browser extension that blocks invisible trackers.' }
                ];

                links.forEach(link => {
                    const card = document.createElement('div');
                    card.style.cssText = `
                    background: #242424;
                    border: 1px solid #303030;
                    border-radius: 12px;
                    padding: 16px;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                    transition: transform 0.2s, box-shadow 0.2s;
                    cursor: pointer;
                `;
                    // Clear any existing content
                    card.innerHTML = '';

                    // Create the heading and link
                    const h4 = document.createElement('h4');
                    h4.style.cssText = 'margin: 0 0 8px; font-size: 15px; color: #4cc9f0;';

                    const a = document.createElement('a');
                    a.href = link.url; // Browsers automatically sanitize href
                    a.target = '_blank';
                    a.style.cssText = 'text-decoration: none; color: inherit;';
                    a.textContent = `${link.name} ↗`; // Safe text content

                    // Create the description paragraph
                    const p = document.createElement('p');
                    p.style.cssText = 'margin: 0; font-size: 13px; color: #d1d5db;';
                    p.textContent = link.desc; // Safe text content

                    // Assemble the elements
                    h4.appendChild(a);
                    card.appendChild(h4);
                    card.appendChild(p);
                    grid.appendChild(card);
                });

                contentArea.appendChild(title);
                contentArea.appendChild(grid);
                contentArea.appendChild(exportBtn);

            } else {
                // Rendu normal pour les autres sections
                const textBlock = document.createElement('div');
                textBlock.textContent = content;
                textBlock.style.cssText = `
                white-space: pre-wrap;
                background: #242424;
                border: 1px solid #303030;
                border-radius: 10px;
                padding: 18px;
                font-size: 15px;
                line-height: 1.75;
                color: #d1d5db;
                box-shadow: 0 2px 6px rgba(0,0,0,0.03);
                margin-bottom: 25px;
            `;
                contentArea.appendChild(textBlock);
            }
        }

        sections.forEach(({ icon, label, key }) => {
            const btn = document.createElement('button');
            btn.textContent = `${icon} ${label}`; // Safe text assignment

            // Couleur spéciale pour le bouton GDPR Score
            let buttonColor = '#e2e8f0';
            if (key === 'gdprScore') {
                const score = extractGDPRScore(parsed[key] || '');
                buttonColor = getScoreColor(score);
            }

            btn.style.cssText = `
        background: none;
        border: none;
        padding: 10px 12px;
        border-radius: 12px;
        margin: 4px 0;
        text-align: left;
        font-size: 14px;
        cursor: pointer;
        color: ${buttonColor};
        transition: background 0.2s;
    `;

            btn.addEventListener('click', () => renderSection(key, label));
            btn.addEventListener('mouseover', () => btn.style.background = '#303030');
            btn.addEventListener('mouseout', () => btn.style.background = 'none');
            sidebar.appendChild(btn);
        });

        const closeBtn = document.createElement('div');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 18px;
        font-size: 24px;
        color: #777;
        cursor: pointer;
        z-index: 1000;
    `;
        closeBtn.addEventListener('click', () => container.remove());

        container.appendChild(sidebar);
        container.appendChild(contentArea);
        container.appendChild(closeBtn);
        document.body.appendChild(container);

        analysisPopup = container;

        // Afficher la première section par défaut
        renderSection(sections[0].key, sections[0].label);




        // Function to generate HTML report from the analysis result
        function generateHTMLReport(analysisResult) {
            const formattedResult = formatResponse(analysisResult);

            const score = extractGDPRScore(parsed['gdprScore'] || '');
            let scoreColor = getScoreColor(score);
            const scoreText = getScoreText(score);

            const htmlReport = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Consent Watcher - Privacy Policy Analysis Report</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <style>
                :root {
                    --primary-color: #4361ee;
                    --primary-light: #4cc9f0;
                    --primary-dark: #3a0ca3;
                    --text-color: #2b2d42;
                    --light-text: #8d99ae;
                    --background: #f8f9fa;
                    --card-bg: #ffffff;
                    --border-radius: 12px;
                    --box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
                    --transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                }

                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                body {
                    font-family: 'Inter', sans-serif;
                    line-height: 1.7;
                    color: var(--text-color);
                    background-color: var(--background);
                    padding: 40px;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .container {
                    max-width: 900px;
                    width: 100%;
                }

                header {
                    text-align: center;
                    margin-bottom: 40px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid var(--primary-light);
                    width: 100%;
                }

                h1 {
                    color: var(--primary-color);
                    font-size: 2.5rem;
                    font-weight: 700;
                    margin-bottom: 10px;
                    background: linear-gradient(90deg, var(--primary-color), var(--primary-light));
                    -webkit-background-clip: text;
                    background-clip: text;
                    color: transparent;
                }

                .subtitle {
                    color: var(--light-text);
                    font-size: 1.1rem;
                    font-weight: 400;
                }

                .report-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 25px;
                    width: 100%;
                }

                .report-card {
                    background-color: var(--card-bg);
                    padding: 30px;
                    border-radius: var(--border-radius);
                    box-shadow: var(--box-shadow);
                    transition: var(--transition);
                    border: 1px solid rgba(0, 0, 0, 0.05);
                }

                .report-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.12);
                }

                .report-card h3 {
                    color: var(--primary-color);
                    margin-bottom: 15px;
                    font-size: 1.4rem;
                    font-weight: 600;
                    padding-bottom: 10px;
                    border-bottom: 2px solid var(--primary-light);
                    display: flex;
                    align-items: center;
                }

                .report-card h3::before {
                    content: "";
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: var(--primary-light);
                    margin-right: 10px;
                }

                .report-card p {
                    color: var(--text-color);
                    font-size: 1rem;
                    line-height: 1.8;
                    margin-bottom: 15px;
                }

                .gdpr-score-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    padding: 20px;
                    position: relative;
                }

                .gdpr-score {
                    font-size: 3rem;
                    font-weight: 700;
                    margin: 15px 0;
                    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                .score-label {
                    color: var(--light-text);
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 10px;
                }

                .score-text {
                    font-size: 1.2rem;
                    font-weight: 600;
                    padding: 8px 16px;
                    border-radius: 20px;
                    color: white;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
                    margin-top: 10px;
                }

                .score-circle {
                    width: 120px;
                    height: 120px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 10px auto;
                    border: 4px solid;
                    position: relative;
                    overflow: hidden;
                }

                .score-circle::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: inherit;
                    opacity: 0.1;
                    border-radius: 50%;
                }

                .advice {
                    font-style: italic;
                    color: var(--light-text);
                    background-color: rgba(141, 153, 174, 0.1);
                    padding: 20px;
                    border-radius: var(--border-radius);
                    border-left: 4px solid var(--primary-light);
                }

                .full-width-card {
                    grid-column: 1 / -1;
                }

                @media (max-width: 768px) {
                    body {
                        padding: 20px;
                    }

                    .report-grid {
                        grid-template-columns: 1fr;
                    }

                    h1 {
                        font-size: 2rem;
                    }

                    .full-width-card {
                        grid-column: auto;
                    }

                    .gdpr-score {
                        font-size: 2.5rem;
                    }

                    .score-circle {
                        width: 100px;
                        height: 100px;
                    }
                }

                .floating-icon {
                    position: fixed;
                    bottom: 30px;
                    right: 30px;
                    width: 60px;
                    height: 60px;
                    background-color: var(--primary-color);
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
                    cursor: pointer;
                    transition: var(--transition);
                    z-index: 100;
                }

                .floating-icon:hover {
                    transform: scale(1.1);
                    background-color: var(--primary-dark);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <header>
                    <h1>Consent Watcher - Privacy Policy Analysis</h1>
                    <p class="subtitle">Comprehensive report on data handling practices</p>
                </header>

                <div class="report-grid">
                    <div class="report-card">
                        <h3>Data Collection</h3>
                        <p>${formattedResult.split('<br>1. ')[1]?.split('<br>2. ')[0] || 'N/A'}</p>
                    </div>

                    <div class="report-card">
                        <h3>Data Sharing</h3>
                        <p>${formattedResult.split('<br>2. ')[1]?.split('<br>3. ')[0] || 'N/A'}</p>
                    </div>

                    <div class="report-card">
                        <h3>Tracking</h3>
                        <p>${formattedResult.split('<br>3. ')[1]?.split('<br>4. ')[0] || 'N/A'}</p>
                    </div>

                    <div class="report-card">
                        <h3>User Rights</h3>
                        <p>${formattedResult.split('<br>4. ')[1]?.split('<br>5. ')[0] || 'N/A'}</p>
                    </div>

                    <div class="report-card full-width-card">
                        <div class="gdpr-score-container">
                            <h3>GDPR Compliance</h3>
                            <span class="score-label">Trust Score</span>
                            
                            <div class="score-circle" style="border-color: ${scoreColor}; color: ${scoreColor};">
                                <div class="gdpr-score">${score !== null ? score.toFixed(1) : 'N/A'}</div>
                            </div>
                            
                            <div class="score-text" style="background-color: ${scoreColor};">
                                ${scoreText}
                            </div>
                        </div>
                    </div>

                    <div class="report-card full-width-card">
                        <h3 id="advices">Privacy Advice</h3>
                        <p class="advice">${formattedResult.split('<br>6. ')[1] || 'N/A'}</p>
                    </div>
                </div>
            </div>

            <div class="floating-icon" title="Scroll to Advice" onclick="document.getElementById('advices').scrollIntoView({ behavior: 'smooth' });">
                ↓
            </div>
        </body>
        </html>
        `;

            const blob = new Blob([htmlReport], {
                type: 'text/html'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'privacy_analysis_report.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }


    }


    // Function to format the response for better readability
    function formatResponse(responseText) {
        let formattedText = responseText.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
        formattedText = formattedText.replace(/(\d+\.)/g, '<br>$1');
        formattedText = formattedText.replace(/-/g, '<br>-');
        return formattedText;
    }



    // Function to extract privacy policy text from the page
    function extractPrivacyPolicyText() {
        const selectors = [
            '[data-testid*="privacy"]',
            '[class*="privacy"]',
            '[id*="privacy"]',
            'main',
            'article',
            '.content',
            '#content',
            'body'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                let text = element.innerText || element.textContent || '';
                text = text.replace(/\s+/g, ' ').trim();
                if (text.length > 500) {
                    console.log(`Texte extrait avec le sélecteur ${selector}:`, text.slice(0, 200) + '...'); // Debug
                    return text;
                }
            }
        }

        const bodyText = document.body.innerText || document.body.textContent || '';
        console.log('Texte du body:', bodyText.slice(0, 200) + '...'); // Debug
        return bodyText;
    }

    // Fonction pour vérifier si la réponse de l'IA indique l'absence de politique de confidentialité
    function isNotPrivacyPolicyResponse(response) {
        // Ne vérifier que la réponse exacte pour éviter les faux positifs
        return response.trim() === 'NOT_PRIVACY_POLICY';
    }

    async function runAnalysis() {
        try {
            console.log('Début de l\'analyse...'); // Debug

            // Vérifier la configuration
            if (!currentConfig.apiKey) {
                console.error('Missing configuration:', currentConfig);
                Showerror('Error: API key not configured. Please configure your API key in the extension settings.');
                return;
            }

            showLoadingPopup();

            // Extraire le texte de la page actuelle
            let policyText = extractVisibleText();
            console.log('Longueur du texte extrait:', policyText.length); // Debug

            // Analyser le texte avec l'IA
            console.log('Appel de l\'API pour analyse initiale...'); // Debug
            const initialAnalysis = await analyzePolicy(policyText);
            console.log('Analyse initiale terminée:', initialAnalysis); // Debug

            // Vérifier si l'IA indique que ce n'est pas une politique de confidentialité
            if (isNotPrivacyPolicyResponse(initialAnalysis)) {
                console.log('L\'IA indique clairement que ce n\'est pas du contenu lié à la confidentialité, recherche en cours...');

                // Chercher la page de politique de confidentialité
                const privacyPolicyUrl = await findPrivacyPolicyPage();

                if (privacyPolicyUrl && privacyPolicyUrl !== window.location.href) {
                    console.log('Page de politique trouvée:', privacyPolicyUrl);

                    // Vérifier qu'on n'est pas déjà sur une page de politique pour éviter les boucles
                    const currentUrl = window.location.href.toLowerCase();
                    const targetUrl = privacyPolicyUrl.toLowerCase();

                    if (currentUrl !== targetUrl && !currentUrl.includes('privacy') && !currentUrl.includes('confidentialite')) {
                        try {
                            // Informer l'utilisateur de la redirection
                            Showerror("No privacy-related content found on this page. Redirecting to privacy policy page...");

                            // Attendre un moment pour que l'utilisateur puisse lire le message
                            await new Promise(resolve => setTimeout(resolve, 2000));

                            // Rediriger vers la page de politique de confidentialité
                            window.location.href = privacyPolicyUrl;
                            return;

                        } catch (redirectError) {
                            console.error('Erreur lors de la redirection:', redirectError);
                            Showerror('❌ Privacy policy page found but could not be accessed. Please navigate to the privacy policy page manually.');
                            return;
                        }
                    } else {
                        console.log('Déjà sur une page de politique ou même URL, pas de redirection');
                        Showerror('❌ This appears to be a privacy policy page, but the content is insufficient or unclear for analysis.');
                        return;
                    }
                } else {
                    console.log('Aucune page de politique de confidentialité trouvée');
                    Showerror('❌ No privacy-related content found on this website. Please look for a "Privacy Policy" or "Legal" section manually.');
                    return;
                }
            }

            // Si l'analyse initiale est valide, afficher les résultats
            console.log('Analyse valide, affichage des résultats'); // Debug
            showAnalysisPopup(initialAnalysis);

        } catch (error) {
            console.error('Erreur lors de l\'analyse:', error);
            Showerror('❌ Error during analysis. Please try again.');
        }
    }

    // Fonction pour détecter si le contenu semble être une politique de confidentialité
    function isProbablyPrivacyPolicy(text) {
        const privacyKeywords = [
            'privacy policy', 'politique de confidentialité', 'personal data', 'données personnelles',
            'cookies', 'data collection', 'collecte de données', 'third parties', 'tiers',
            'data processing', 'traitement des données', 'user information', 'informations utilisateur'
        ];

        const lowerText = text.toLowerCase();
        const keywordMatches = privacyKeywords.filter(keyword =>
            lowerText.includes(keyword.toLowerCase())
        ).length;

        // Si au moins 3 mots-clés sont trouvés, c'est probablement une politique de confidentialité
        return keywordMatches >= 3;
    }

    // Fonction pour trouver l'URL de la page de politique de confidentialité
    async function findPrivacyPolicyPage() {
        const selectors = [
            'a[href*="privacy"]',
            'a[href*="confidentialite"]',
            'a[href*="privacy-policy"]',
            'a[href*="politique-confidentialite"]',
            'a[href*="privacidad"]',
            'a[href*="datenschutz"]'
        ];

        const textPatterns = [
            /privacy\s+policy/i,
            /politique\s+de\s+confidentialité/i,
            /confidentialité/i,
            /privacy/i,
            /datos\s+personales/i,
            /datenschutz/i
        ];

        // Chercher par sélecteurs CSS
        for (const selector of selectors) {
            const links = document.querySelectorAll(selector);
            for (const link of links) {
                if (link.href && link.href !== window.location.href) {
                    return link.href;
                }
            }
        }

        // Chercher par texte des liens
        const allLinks = document.querySelectorAll('a');
        for (const link of allLinks) {
            const linkText = link.textContent.trim();
            for (const pattern of textPatterns) {
                if (pattern.test(linkText) && link.href && link.href !== window.location.href) {
                    return link.href;
                }
            }
        }

        // Chercher dans le footer
        const footer = document.querySelector('footer');
        if (footer) {
            const footerLinks = footer.querySelectorAll('a');
            for (const link of footerLinks) {
                const linkText = link.textContent.trim().toLowerCase();
                if ((linkText.includes('privacy') || linkText.includes('confidentialité'))
                    && link.href && link.href !== window.location.href) {
                    return link.href;
                }
            }
        }

        // URLs communes à essayer
        const commonPaths = [
            '/privacy',
            '/privacy-policy',
            '/politique-confidentialite',
            '/confidentialite',
            '/legal/privacy',
            '/privacy.html',
            '/privacy.php'
        ];

        const baseUrl = window.location.origin;
        for (const path of commonPaths) {
            const testUrl = baseUrl + path;
            if (await urlExists(testUrl)) {
                return testUrl;
            }
        }

        return null;
    }

    // Fonction pour vérifier si une URL existe
    async function urlExists(url) {
        try {
            const response = await fetch(url, {
                method: 'HEAD',
                mode: 'no-cors'
            });
            return response.ok || response.type === 'opaque';
        } catch {
            return false;
        }
    }

    // Fonction pour récupérer le contenu d'une page de politique de confidentialité
    async function fetchPrivacyPolicyContent(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Supprimer les scripts et styles
            const scripts = doc.querySelectorAll('script, style');
            scripts.forEach(el => el.remove());

            // Extraire le texte visible
            return doc.body.textContent || doc.body.innerText || '';

        } catch (error) {
            console.error('Erreur lors de la récupération du contenu:', error);
            return null;
        }
    }

    // Initialize when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createActionButton);
    } else {
        createActionButton();
    }

    // Add CSS styles for animations
    function isValidCSSColor(color) {
        if (!color || typeof color !== 'string') return false;

        // Check for valid CSS color formats
        const colorRegex = /^(#[0-9A-Fa-f]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)|hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*[\d.]+\s*\)|[a-zA-Z]+)$/;

        return colorRegex.test(color.trim());
    }

    const safeScrollbarColor = isValidCSSColor(primaryLightColor) ? primaryLightColor : '#cccccc';
    const safeScrollbarHoverColor = isValidCSSColor(primaryColor) ? primaryColor : '#999999';

    const styleEnhancer = document.createElement("style");
    styleEnhancer.textContent = `
    @keyframes fadeInScale {
        0% { opacity: 0; transform: scale(0.9); }
        100% { opacity: 1; transform: scale(1); }
    }
    @keyframes ripple {
        to { transform: scale(4); opacity: 0; }
    }
    button:hover {
        transition: all 0.3s ease;
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(67, 97, 238, 0.3);
    }
    ::-webkit-scrollbar {
        width: 8px;
    }
    ::-webkit-scrollbar-thumb {
        background-color: ${safeScrollbarColor};
        border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
        background-color: ${safeScrollbarHoverColor};
    }
`;
    document.head.appendChild(styleEnhancer);

})();
