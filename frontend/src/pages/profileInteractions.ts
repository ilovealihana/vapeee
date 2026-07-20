export interface ProfileLanguageButton {
  disabled: boolean;
  dataset: {
    profileLanguage?: string;
  };
  classList: {
    toggle: (name: string, force?: boolean) => void;
  };
  getAttribute: (name: string) => string | null;
  setAttribute: (name: string, value: string) => void;
}

export interface ProfileLanguageCurrent {
  textContent: string | null;
}

export function selectProfileLanguage(
  button: ProfileLanguageButton,
  languageButtons: ProfileLanguageButton[],
  currentLanguage?: ProfileLanguageCurrent | null,
): boolean {
  if (button.disabled || button.getAttribute('aria-disabled') === 'true') {
    return false;
  }

  languageButtons.forEach((option) => {
    const isSelected = option === button;
    option.classList.toggle('is-selected', isSelected);
    option.setAttribute('aria-checked', String(isSelected));
  });

  if (currentLanguage && button.dataset.profileLanguage) {
    currentLanguage.textContent = button.dataset.profileLanguage;
  }

  return true;
}
