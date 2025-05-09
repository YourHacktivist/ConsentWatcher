// ==UserScript==
// @name        Privacy Policy Analyzer Lite
// @namespace   http://tampermonkey.net/
// @version     1.2
// @description Analyzes the privacy policy of the current page on demand using the ChatGPT API (HTML text only) and generate a report in HTML format.
// @author      Osiris, Lokuste, Dragdead, Neewz
// @match       *://*/*
// @grant       GM_xmlhttpRequest
// @connect     api.openai.com
// ==/UserScript==

(function() {
    'use strict';

    const openAiApiKey = 'your-api-key-here';

    let analysisPopup = null;
    let isDragging = false;
    let offsetX, offsetY;
    const primaryColor = '#4361ee'; // Main color
    const primaryLightColor = '#4cc9f0';
    const textColor = '#212121';
    const cardBackgroundColor = '#fff';
    const boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
    const borderRadius = '8px';
    const fontFamily = 'Roboto, sans-serif';

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
        button.addEventListener('mouseover', () => button.style.backgroundColor = primaryLightColor);
        button.addEventListener('mouseout', () => button.style.backgroundColor = primaryColor);
        button.addEventListener('click', (e) => {
            const circle = document.createElement("span");
            circle.style.position = "absolute";
            circle.style.borderRadius = "50%";
            circle.style.transform = "scale(0)";
            circle.style.animation = "ripple 600ms linear";
            circle.style.backgroundColor = "rgba(255, 255, 255, 0.7)";
            circle.style.pointerEvents = "none";
            const rect = button.getBoundingClientRect();
            circle.style.left = `${e.clientX - rect.left}px`;
            circle.style.top = `${e.clientY - rect.top}px`;
            circle.style.width = circle.style.height = "100px";
            button.appendChild(circle);
            setTimeout(() => circle.remove(), 600);
            runAnalysis();
        });

        // Add ripple effect
        const rippleStyle = document.createElement("style");
        rippleStyle.innerHTML = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }`;
        document.head.appendChild(rippleStyle);


        document.body.appendChild(button);
    }

    // Function to analyze the privacy policy using OpenAI API
    async function analyzePolicy(text) {
        const prompt = `
You are a privacy assistant. Analyze the following privacy policy and provide concise answers to these questions, ensuring each point starts on a new line:

1. **Data Collection:** What types of personal data are collected? (e.g., name, email, browsing history)
-
2. **Data Sharing:** Is personal data shared with third parties? If so, with whom and for what purpose?
-
3. **Tracking:** Are cookies or other tracking technologies used? If yes, for what purposes?
-
4. **User Rights:** What rights do users have regarding their data? (e.g., access, deletion, rectification)
-
5. **GDPR Score:** Give a GDPR trust score (0 to 10, where 10 is fully compliant and trustworthy).
-
6. **Privacy Advice:** Provide one key piece of practical privacy advice for the user of this website.

Format your response with bullet points where applicable. Ensure that each number followed by a period starts on a new line. Use **bold** for emphasis where appropriate as indicated in the questions.
`;

        const policyContent = `
Policy content:
"""${text.slice(0, 8000)}"""
`;

        const fullPrompt = prompt + policyContent;

        const body = JSON.stringify({
            model: "gpt-4", // or "gpt-3.5-turbo"
            messages: [{
                role: "user",
                content: fullPrompt
            }],
            temperature: 0.3
        });

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${openAiApiKey}`
            },
            body: body
        });

        const data = await res.json();
        return data.choices?.[0]?.message?.content || 'Error during analysis.';
    }

    // Function to format the response for better readability
    function formatResponse(responseText) {
        let formattedText = responseText.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
        formattedText = formattedText.replace(/(\d+\.)/g, '<br>$1');
        formattedText = formattedText.replace(/-/g, '<br>-');
        return formattedText;
    }

    // Function to extract visible text from the page
    function extractVisibleText() {
        const elements = Array.from(document.body.querySelectorAll('p, div, span, li'));
        const visibleText = elements
            .filter(el => el.offsetParent !== null)
            .map(el => el.innerText.trim())
            .filter(t => t.length > 100)
            .join('\n');
        return visibleText;
    }

    // Function to show a loading popup while analyzing
    function showLoadingPopup() {
        const primaryColor = '#4361ee';
        const primaryLight = '#4cc9f0';
        const cardBackgroundColor = '#ffffff';
        const borderRadius = '16px';
        const boxShadow = '0 15px 40px rgba(0, 0, 0, 0.1)';
        const fontFamily = `'Inter', sans-serif`;

        analysisPopup = document.createElement('div');
        analysisPopup.style.position = 'fixed';
        analysisPopup.style.top = '50%';
        analysisPopup.style.left = '50%';
        analysisPopup.style.transform = 'translate(-50%, -50%)';
        analysisPopup.style.backgroundColor = cardBackgroundColor;
        analysisPopup.style.border = `1px solid ${primaryLight}`;
        analysisPopup.style.padding = '40px 30px';
        analysisPopup.style.zIndex = 99999;
        analysisPopup.style.borderRadius = borderRadius;
        analysisPopup.style.boxShadow = boxShadow;
        analysisPopup.style.fontFamily = fontFamily;
        analysisPopup.style.color = primaryColor;
        analysisPopup.style.textAlign = 'center';
        analysisPopup.style.minWidth = '320px';
        analysisPopup.style.transition = 'opacity 0.4s ease';

        const title = document.createElement('div');
        title.style.fontSize = '20px';
        title.style.fontWeight = '600';
        title.textContent = 'Consent Watcher is scanning...';
        analysisPopup.appendChild(title);

        const subtitle = document.createElement('div');
        subtitle.style.marginTop = '8px';
        subtitle.style.fontSize = '14px';
        subtitle.style.color = '#8d99ae';
        subtitle.textContent = 'Analyzing terms for data privacy risks';
        analysisPopup.appendChild(subtitle);

        const radarWrapper = document.createElement('div');
        radarWrapper.className = 'radar-wrapper';
        analysisPopup.appendChild(radarWrapper);

        const radarSweep = document.createElement('div');
        radarSweep.className = 'radar-sweep';
        radarWrapper.appendChild(radarSweep);

        const radarDot = document.createElement('div');
        radarDot.className = 'radar-dot';
        radarWrapper.appendChild(radarDot);

        document.body.appendChild(analysisPopup);

        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = `
        .radar-wrapper {
            margin: 30px auto 0;
            width: 100px;
            height: 100px;
            position: relative;
        }
        .radar-wrapper::before,
        .radar-wrapper::after {
            content: '';
            position: absolute;
            border: 2px solid rgba(67, 97, 238, 0.2);
            border-radius: 50%;
            animation: pulse-circle 2s infinite ease-in-out;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
        }
        .radar-wrapper::before {
            width: 100px;
            height: 100px;
            animation-delay: 0s;
        }
        .radar-wrapper::after {
            width: 130px;
            height: 130px;
            animation-delay: 1s;
        }
        .radar-sweep {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            background: conic-gradient(rgba(41, 255, 94, 0.5), transparent 30%, transparent 100%);
            animation: sweep 2s linear infinite;
            position: absolute;
            top: 0;
            left: 0;
        }
        .radar-dot {
            position: absolute;
            width: 8px;
            height: 8px;
            background-color: transparent;
            border-radius: 50%;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            animation: rotate-dot 2s linear infinite;
        }
        @keyframes sweep {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        @keyframes pulse-circle {
            0% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.6; }
            50% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
            100% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.6; }
        }
        @keyframes rotate-dot {
            0% { transform: rotate(0deg) translateX(-50%) translateY(-45px); }
            100% { transform: rotate(360deg) translateX(-50%) translateY(-45px); }
        }
    `;
        document.head.appendChild(styleSheet);
    }


    function parseGPTResponse(text) {
        const sections = {
            dataCollection: '',
            dataSharing: '',
            tracking: '',
            userRights: '',
            gdprScore: '',
            privacyAdvice: '',
        };

        const regexMap = {
            dataCollection: /^1\.\s\*\*Data Collection:\*\*(.*?)^2\./ms,
            dataSharing: /^2\.\s\*\*Data Sharing:\*\*(.*?)^3\./ms,
            tracking: /^3\.\s\*\*Tracking:\*\*(.*?)^4\./ms,
            userRights: /^4\.\s\*\*User Rights:\*\*(.*?)^5\./ms,
            gdprScore: /^5\.\s\*\*GDPR Score:\*\*(.*?)^6\./ms,
            privacyAdvice: /^6\.\s\*\*Privacy Advice:\*\*(.*)$/ms,
        };

        for (const [key, regex] of Object.entries(regexMap)) {
            const match = text.match(regex);
            if (match) sections[key] = match[1].trim();
        }

        return sections;
    }

    function deleteAllCookies() {
    const cookies = document.cookie.split(";");

    for (let cookie of cookies) {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + location.hostname;
    }
}
    function showConfirmation(message) {
    const msg = document.createElement('div');
    msg.textContent = message;
    msg.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #22c55e;
        color: white;
        padding: 12px 18px;
        border-radius: 10px;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 999999;
        animation: fadeInOut 3s ease forwards;
    `;
    document.body.appendChild(msg);

    setTimeout(() => msg.remove(), 3000);
}
    // Function to show the analysis result in a popup
    async function showAnalysisPopup(gptResponseText) {
        if (analysisPopup) analysisPopup.remove();

        const parsed = parseGPTResponse(gptResponseText);

        const sections = [{
                icon: '📥',
                label: 'Collected data',
                key: 'dataCollection'
            },
            {
                icon: '🔄',
                label: 'Data sharing',
                key: 'dataSharing'
            },
            {
                icon: '🍪',
                label: 'Tracking',
                key: 'tracking'
            },
            {
                icon: '🧑‍⚖️',
                label: 'User rights',
                key: 'userRights'
            },
            {
                icon: '📊',
                label: 'GDPR score',
                key: 'gdprScore'
            },
            {
                icon: '💡',
                label: 'Privacy advice',
                key: 'privacyAdvice'
            },
        ];

        const container = document.createElement('div');
        container.style.cssText = `
        position: fixed;
        top: 60px;
        left: 60px;
        width: 760px;
        height: 520px;
        display: flex;
        background: #ffffffee;
        border-radius: 18px;
        box-shadow: 0 18px 36px rgba(0,0,0,0.25);
        backdrop-filter: blur(14px);
        z-index: 99999;
        overflow: hidden;
        font-family: system-ui, sans-serif;
    `;

        let isDragging = false,
            offsetX, offsetY;
        container.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - container.getBoundingClientRect().left;
            offsetY = e.clientY - container.getBoundingClientRect().top;
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            container.style.left = `${e.clientX - offsetX}px`;
            container.style.top = `${e.clientY - offsetY}px`;
        });
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        const sidebar = document.createElement('div');
        sidebar.style.cssText = `
        width: 190px;
        background: #f5f5f5;
        border-right: 1px solid #ddd;
        display: flex;
        flex-direction: column;
        padding: 10px;
    `;

        const contentArea = document.createElement('div');
        contentArea.style.cssText = `
        flex: 1;
        padding: 25px;
        overflow-y: auto;
        font-size: 15px;
        color: #333;
        line-height: 1.7;
        position: relative;
    `;

        const exportBtn = document.createElement('button');
        exportBtn.textContent = '📄 Export HTML';
        exportBtn.style.cssText = `
        position: absolute;
        bottom: 20px;
        right: 25px;
        background: #3b82f6;
        color: white;
        padding: 10px 16px;
        font-size: 14px;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        transition: background 0.2s ease;
    `;
        exportBtn.addEventListener('mouseover', () => exportBtn.style.background = '#2563eb');
        exportBtn.addEventListener('mouseout', () => exportBtn.style.background = '#3b82f6');
        exportBtn.addEventListener('click', () => generateHTMLReport(gptResponseText));

        function renderSection(key, label) {
    contentArea.innerHTML = `
        <h2 style="margin-top: 0; font-size: 18px; color: #1e40af;">${label}</h2>
        <div style="white-space: pre-wrap; margin-bottom: 20px;">${parsed[key] || '❌ Aucun contenu trouvé.'}</div>
    `;

    // Ajout du switch dans la section "Tracking"
    if (key === 'tracking') {
        const toggleContainer = document.createElement('div');
        toggleContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 25px;
        `;

        const labelEl = document.createElement('label');
        labelEl.textContent = '🔒 Bloquer les cookies';
        labelEl.style.fontWeight = 'bold';

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
                customSwitch.style.background = '#22c55e'; // vert
                knob.style.left = '20px';
                deleteAllCookies();
                showConfirmation("Cookies bloqués ✅");
            } else {
                customSwitch.style.background = '#ccc';
                knob.style.left = '2px';
            }
        });

        toggleContainer.appendChild(labelEl);
        toggleContainer.appendChild(customSwitch);
        contentArea.appendChild(toggleContainer);
    }

    contentArea.appendChild(exportBtn);
}

        sections.forEach(({
            icon,
            label,
            key
        }) => {
            const btn = document.createElement('button');
            btn.innerHTML = `${icon} ${label}`;
            btn.style.cssText = `
            background: none;
            border: none;
            padding: 10px 12px;
            border-radius: 12px;
            margin: 4px 0;
            text-align: left;
            font-size: 14px;
            cursor: pointer;
            color: #444;
            transition: background 0.2s;
        `;
            btn.addEventListener('click', () => renderSection(key, label));
            btn.addEventListener('mouseover', () => btn.style.background = '#e0e0e0');
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
    `;
        closeBtn.addEventListener('click', () => container.remove());

        container.appendChild(sidebar);
        container.appendChild(contentArea);
        container.appendChild(closeBtn);
        document.body.appendChild(container);

        // default section
        renderSection(sections[0].key, sections[0].label);
    }


    function getSectionContent(key, parsed) {
        return `<div style="white-space: pre-wrap;">${parsed[key].trim()}</div>`;
    }

    // Function to generate HTML report from the analysis result
    function generateHTMLReport(analysisResult) {
        const formattedResult = formatResponse(analysisResult);

        let gdprScore = 'N/A';
        const gdprRegex = /5\.\s*\*\*GDPR Score:\*\*\s*([0-9\.]+)/i;
        const scoreMatch = analysisResult.match(gdprRegex);
        if (scoreMatch && scoreMatch[1]) {
            gdprScore = scoreMatch[1].trim();
        } else {
            const altRegex = /GDPR\s*[Ss]core:?\s*([0-9\.]+)/;
            const altMatch = analysisResult.match(altRegex);
            if (altMatch && altMatch[1]) {
                gdprScore = altMatch[1].trim();
            }
        }

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
                }
    
                .gdpr-score {
                    font-size: 2.5rem;
                    font-weight: 700;
                    color: var(--primary-color);
                    margin: 10px 0;
                }
    
                .score-label {
                    color: var(--light-text);
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
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
                            <div class="gdpr-score">${gdprScore !== 'N/A' ? gdprScore : 'N/A'}</div>
                            <span class="score-label">Trust Score</span>
                        </div>
                    </div>
    
                    <div class="report-card full-width-card">
                        <h3 id="advices">Privacy Advice</h3>
                        <p class="advice">${formattedResult.split('<br>6. ')[1] || 'N/A'}</p>
                    </div>
                </div>
            </div>
    
            <div class="floating-icon" title="Download Report" onclick="document.getElementById('advices').scrollIntoView({ behavior: 'smooth' });">
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

    // Function to show a loading popup while analyzing
    async function runAnalysis() {
        const text = extractVisibleText();
        if (text.length < 1000) {
            console.log("Not enough text for a useful analysis.");
            return;
        }

        showLoadingPopup();
        const result = await analyzePolicy(text);
        showAnalysisPopup(result);
    }

    // Create the action button when the script loads
    createActionButton();

    // Add CSS styles for the popup and button
    const styleEnhancer = document.createElement("style");
    styleEnhancer.innerHTML = `
@keyframes fadeInScale {
    0% { opacity: 0; transform: scale(0.9); }
    100% { opacity: 1; transform: scale(1); }
}

button:hover {
    transition: all 0.3s ease;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(76, 175, 80, 0.3);
}

div.analysis-popup, div.loading-popup {
    animation: fadeInScale 0.4s ease-out;
    backdrop-filter: blur(12px);
    background: rgba(255, 255, 255, 0.75);
    border: 1px solid rgba(200, 200, 200, 0.3);
}

::-webkit-scrollbar {
    width: 8px;
}
::-webkit-scrollbar-thumb {
    background-color: ${primaryLightColor};
    border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
    background-color: ${primaryColor};
}
`;
    document.head.appendChild(styleEnhancer);

})();
