export class GrammarChecker {
  private grammarInput: HTMLTextAreaElement;
  private grammarResults: HTMLElement;
  private checkButton: HTMLElement;

  constructor() {
    this.grammarInput = document.getElementById('grammar-input') as HTMLTextAreaElement;
    this.grammarResults = document.getElementById('grammar-results')!;
    this.checkButton = document.getElementById('check-grammar')!;

    this.init();
  }

  private init() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
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

  private async checkGrammar() {
    const text = this.grammarInput.value.trim();

    if (!text) {
      this.showResults('Please enter some text to check.', 'error');
      return;
    }

    this.showResults('Checking grammar...', 'loading');
    this.checkButton.textContent = 'Checking...';
    this.checkButton.setAttribute('disabled', 'true');

    try {
      const response = await (window as any).electronAPI.grammar.checkGrammar(text);
      if (response.success) {
        this.showResults(response.result || 'No response received from OpenAI.', 'success');
      } else {
        this.showResults(`Error: ${response.error || 'Unknown error occurred'}`, 'error');
      }
    } catch (error) {
      this.showResults('Error checking grammar. Please try again.', 'error');
    } finally {
      this.checkButton.textContent = 'Check Grammar';
      this.checkButton.removeAttribute('disabled');
    }
  }

  private showResults(content: string, type: 'success' | 'error' | 'loading') {
    this.grammarResults.innerHTML = content;
    this.grammarResults.className = `grammar-results ${type}`;
  }
}
