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
    // You can edit this function to add your own AI model
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
            messages: [{ role: "user", content: fullPrompt }],
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
        analysisPopup = document.createElement('div');
        analysisPopup.style.position = 'fixed';
        analysisPopup.style.top = '50%';
        analysisPopup.style.left = '50%';
        analysisPopup.style.transform = 'translate(-50%, -50%)';
        analysisPopup.style.backgroundColor = cardBackgroundColor;
        analysisPopup.style.border = `1px solid ${primaryLightColor}`;
        analysisPopup.style.padding = '30px';
        analysisPopup.style.zIndex = 99999;
        analysisPopup.style.borderRadius = borderRadius;
        analysisPopup.style.boxShadow = boxShadow;
        analysisPopup.style.fontFamily = fontFamily;
        analysisPopup.style.color = primaryColor;
        analysisPopup.style.fontSize = '18px';
        analysisPopup.style.fontWeight = 'bold';
        analysisPopup.textContent = 'Analyzing Privacy Policy...';

        const loader = document.createElement('div');
        loader.style.border = '5px solid #f3f3f3';
        loader.style.borderTop = `5px solid ${primaryColor}`;
        loader.style.borderRadius = '50%';
        loader.style.width = '40px';
        loader.style.height = '40px';
        loader.style.margin = '15px auto 0';
        loader.style.animation = 'spin 2s linear infinite';

        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
        document.head.appendChild(styleSheet);

        analysisPopup.appendChild(loader);
        document.body.appendChild(analysisPopup);
    }

    // Function to show the analysis result in a popup
    function showAnalysisPopup(result) {
        if (analysisPopup) {
            analysisPopup.remove();
        }

        const box = document.createElement('div');
        box.style.position = 'fixed';
        box.style.top = '50px';
        box.style.right = '50px';
        box.style.backgroundColor = cardBackgroundColor;
        box.style.border = `1px solid ${primaryLightColor}`;
        box.style.padding = '25px';
        box.style.zIndex = 99999;
        box.style.maxWidth = '600px';
        box.style.maxHeight = '80vh';
        box.style.overflowY = 'auto';
        box.style.fontSize = '16px';
        box.style.fontFamily = fontFamily;
        box.style.lineHeight = '1.7';
        box.style.color = textColor;
        box.style.boxShadow = boxShadow;
        box.style.borderRadius = borderRadius;
        box.style.cursor = 'grab';

        // Make draggable
        box.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - box.getBoundingClientRect().left;
            offsetY = e.clientY - box.getBoundingClientRect().top;
            box.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            box.style.left = e.clientX - offsetX + 'px';
            box.style.top = e.clientY - offsetY + 'px';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            box.style.cursor = 'grab';
        });

        const titleBar = document.createElement('div');
        titleBar.style.display = 'flex';
        titleBar.style.justifyContent = 'space-between';
        titleBar.style.alignItems = 'center';
        titleBar.style.marginBottom = '15px';
        titleBar.style.paddingBottom = '10px';
        titleBar.style.borderBottom = `1px solid ${primaryLightColor}`;

        const title = document.createElement('h2');
        title.textContent = 'Privacy Policy Analysis';
        title.style.margin = '0';
        title.style.color = primaryColor;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.fontSize = '24px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.color = '#757575';
        closeBtn.addEventListener('click', () => box.remove());
        closeBtn.addEventListener('mouseover', () => closeBtn.style.color = textColor);
        closeBtn.addEventListener('mouseout', () => closeBtn.style.color = '#757575');

        titleBar.appendChild(title);
        titleBar.appendChild(closeBtn);
        box.appendChild(titleBar);

        const content = document.createElement('div');
        content.style.marginTop = '15px';
        content.innerHTML = formatResponse(result);
        box.appendChild(content);

        const reportButton = document.createElement('button');
        reportButton.textContent = 'Generate HTML Report';
        reportButton.style.backgroundColor = primaryColor;
        reportButton.style.color = 'white';
        reportButton.style.padding = '10px 15px';
        reportButton.style.border = 'none';
        reportButton.style.borderRadius = borderRadius;
        reportButton.style.cursor = 'pointer';
        reportButton.style.fontSize = '14px';
        reportButton.style.fontFamily = fontFamily;
        reportButton.style.boxShadow = boxShadow;
        reportButton.style.marginTop = '20px';
        reportButton.addEventListener('mouseover', () => reportButton.style.backgroundColor = primaryLightColor);
        reportButton.addEventListener('mouseout', () => reportButton.style.backgroundColor = primaryColor);
        reportButton.addEventListener('click', () => generateHTMLReport(result));
        box.appendChild(reportButton);

        document.body.appendChild(box);
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
            <title>Privacy Policy Analysis Report</title>
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
                    <h1>Privacy Policy Analysis</h1>
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
                        <h3>Privacy Advice</h3>
                        <p class="advice">${formattedResult.split('<br>6. ')[1] || 'N/A'}</p>
                    </div>
                </div>
            </div>
    
            <div class="floating-icon" title="Download Report">
                ↓
            </div>
        </body>
        </html>
        `;
    
        const blob = new Blob([htmlReport], { type: 'text/html' });
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
