"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrammarChecker = void 0;
class GrammarChecker {
    grammarInput;
    grammarResults;
    checkButton;
    constructor() {
        this.grammarInput = document.getElementById('grammar-input');
        this.grammarResults = document.getElementById('grammar-results');
        this.checkButton = document.getElementById('check-grammar');
        this.init();
    }
    init() {
        this.setupEventListeners();
    }
    setupEventListeners() {
        this.checkButton.addEventListener('click', () => {
            this.checkGrammar();
        });
        this.grammarInput.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.checkGrammar();
            }
        });
    }
    async checkGrammar() {
        const text = this.grammarInput.value.trim();
        if (!text) {
            this.showResults('Please enter some text to check.', 'error');
            return;
        }
        this.showResults('Checking grammar...', 'loading');
        this.checkButton.textContent = 'Checking...';
        this.checkButton.setAttribute('disabled', 'true');
        try {
            const response = await window.electronAPI.grammar.checkGrammar(text);
            if (response.success) {
                this.showResults(response.result || 'No response received from OpenAI.', 'success');
            }
            else {
                this.showResults(`Error: ${response.error || 'Unknown error occurred'}`, 'error');
            }
        }
        catch (error) {
            this.showResults('Error checking grammar. Please try again.', 'error');
        }
        finally {
            this.checkButton.textContent = 'Check Grammar';
            this.checkButton.removeAttribute('disabled');
        }
    }
    showResults(content, type) {
        this.grammarResults.innerHTML = content;
        this.grammarResults.className = `grammar-results ${type}`;
    }
}
exports.GrammarChecker = GrammarChecker;
//# sourceMappingURL=GrammarChecker.js.map