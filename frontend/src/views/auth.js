import { formatCpf, onlyDigits } from '../core/formatters.js';
import { homeRouteForRole } from '../core/permissions.js';
import {
  button,
  escapeHtml,
  icon,
  setButtonBusy,
} from '../components/ui-kit.js';

const AUTH_ERROR_MESSAGE =
  'Não foi possível entrar. Confira os dados informados e tente novamente.';

function brandMarkup() {
  return `<span class="brand" aria-label="AutoGestão Pro">
    <span class="brand-mark" aria-hidden="true">${icon('speed')}</span>
    <span class="brand-copy"><strong>AutoGestão</strong><small>PRO</small></span>
  </span>`;
}

function fieldMessage(id) {
  return `<p class="field-error" id="${id}-error" role="alert" hidden></p>`;
}

function operatorForm() {
  return `<form class="auth-form" id="operator-login-form" data-auth-form="operator" novalidate>
    <div class="field" data-field="operator-email">
      <label for="operator-email">E-mail <span class="required-mark" aria-hidden="true">*</span></label>
      <div class="input-group">
        <span class="input-leading">${icon('mail')}</span>
        <input class="input" id="operator-email" name="email" type="email" inputmode="email" autocomplete="username" maxlength="254" placeholder="nome@oficina.com.br" required aria-describedby="operator-email-error">
      </div>
      ${fieldMessage('operator-email')}
    </div>
    <div class="field" data-field="operator-password">
      <label for="operator-password">Senha <span class="required-mark" aria-hidden="true">*</span></label>
      <div class="input-group has-trailing">
        <span class="input-leading">${icon('lock')}</span>
        <input class="input" id="operator-password" name="senha" type="password" autocomplete="current-password" placeholder="Digite sua senha" required aria-describedby="operator-password-error">
        <button class="icon-button" type="button" data-action="toggle-password" aria-label="Mostrar senha" aria-controls="operator-password" aria-pressed="false">${icon('visibility')}</button>
      </div>
      ${fieldMessage('operator-password')}
    </div>
    <div class="alert alert-error" id="operator-auth-error" role="alert" tabindex="-1" hidden>
      ${icon('error')}<div><strong class="alert-title">Acesso não confirmado</strong><p class="alert-copy">${escapeHtml(AUTH_ERROR_MESSAGE)}</p></div>
    </div>
    ${button({
      label: 'Entrar como equipe',
      iconName: 'login',
      variant: 'primary',
      type: 'submit',
      className: 'button-wide',
      attributes: 'data-submit-auth="operator"',
    })}
  </form>`;
}

function clientForm() {
  return `<form class="auth-form" id="client-login-form" data-auth-form="client" novalidate>
    <div class="field" data-field="client-cpf">
      <label for="client-cpf">CPF <span class="required-mark" aria-hidden="true">*</span></label>
      <div class="input-group">
        <span class="input-leading">${icon('badge')}</span>
        <input class="input" id="client-cpf" name="cpf" type="text" inputmode="numeric" autocomplete="username" maxlength="14" placeholder="000.000.000-00" required aria-describedby="client-cpf-help client-cpf-error">
      </div>
      <p class="field-help" id="client-cpf-help">Use o CPF cadastrado na oficina.</p>
      ${fieldMessage('client-cpf')}
    </div>
    <div class="alert alert-error" id="client-auth-error" role="alert" tabindex="-1" hidden>
      ${icon('error')}<div><strong class="alert-title">Acesso não confirmado</strong><p class="alert-copy">${escapeHtml(AUTH_ERROR_MESSAGE)}</p></div>
    </div>
    ${button({
      label: 'Acompanhar meu veículo',
      iconName: 'login',
      variant: 'primary',
      type: 'submit',
      className: 'button-wide',
      attributes: 'data-submit-auth="client"',
    })}
  </form>`;
}

export function renderLoginView() {
  return `<main class="auth-layout" id="main-content">
    <section class="auth-visual" aria-labelledby="auth-welcome-title">
      <div class="auth-visual-content">
        ${brandMarkup()}
        <p class="page-eyebrow">Gestão da oficina em movimento</p>
        <h1 id="auth-welcome-title">Cada serviço na etapa certa, com clareza para a equipe e para o cliente.</h1>
        <p>Acompanhe ordens de serviço, aprovações e execução em uma experiência operacional direta e segura.</p>
      </div>
    </section>
    <section class="auth-panel" aria-labelledby="auth-title">
      <div class="auth-card">
        ${brandMarkup()}
        <p class="page-eyebrow">Área segura</p>
        <h2 class="auth-title" id="auth-title">Entre no AutoGestão Pro</h2>
        <p class="auth-subtitle">Escolha o tipo de acesso para continuar.</p>

        <div class="tabs" role="tablist" aria-label="Tipo de acesso" data-auth-tabs>
          <button class="tab is-active" id="client-tab" type="button" role="tab" aria-selected="true" aria-controls="client-panel" tabindex="0" data-auth-tab="client">${icon('person')}<span>Cliente</span></button>
          <button class="tab" id="operator-tab" type="button" role="tab" aria-selected="false" aria-controls="operator-panel" tabindex="-1" data-auth-tab="operator">${icon('engineering')}<span>Equipe</span></button>
        </div>

        <section class="tab-panel" id="client-panel" role="tabpanel" aria-labelledby="client-tab" data-auth-panel="client">
          ${clientForm()}
        </section>
        <section class="tab-panel" id="operator-panel" role="tabpanel" aria-labelledby="operator-tab" data-auth-panel="operator" hidden>
          ${operatorForm()}
        </section>

      </div>
    </section>
  </main>`;
}

function isValidEmail(value) {
  const email = String(value ?? '').trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidCpf(value) {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const calculateDigit = (length) => {
    const sum = digits
      .slice(0, length)
      .split('')
      .reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(digits[9]) &&
    calculateDigit(10) === Number(digits[10]);
}

function setFieldError(root, inputId, message = '') {
  const input = root.querySelector(`#${inputId}`);
  const field = root.querySelector(`[data-field="${inputId}"]`);
  const error = root.querySelector(`#${inputId}-error`);
  const invalid = Boolean(message);
  input?.setAttribute('aria-invalid', String(invalid));
  field?.classList.toggle('is-invalid', invalid);
  if (error) {
    error.textContent = message;
    error.hidden = !invalid;
  }
}

function clearAuthError(root, kind) {
  const error = root.querySelector(`#${kind}-auth-error`);
  if (error) error.hidden = true;
}

function showAuthError(root, kind) {
  const error = root.querySelector(`#${kind}-auth-error`);
  if (!error) return;
  error.hidden = false;
  error.focus();
}

function validateOperator(root, form) {
  const data = new FormData(form);
  const email = String(data.get('email') ?? '').trim().toLowerCase();
  const senha = String(data.get('senha') ?? '');
  setFieldError(root, 'operator-email', isValidEmail(email) ? '' : 'Informe um e-mail válido.');
  setFieldError(root, 'operator-password', senha ? '' : 'Informe sua senha.');
  return isValidEmail(email) && Boolean(senha) ? { email, senha } : null;
}

function validateClient(root, form) {
  const cpf = onlyDigits(new FormData(form).get('cpf'));
  setFieldError(root, 'client-cpf', isValidCpf(cpf) ? '' : 'Informe um CPF válido com 11 dígitos.');
  return isValidCpf(cpf) ? { cpf } : null;
}

function setFormBusy(root, form, busy, label) {
  const submit = form.querySelector('[data-submit-auth]');
  setButtonBusy(submit, busy, label);
  form.querySelectorAll('input, button').forEach((control) => {
    if (control !== submit) control.disabled = busy;
  });
  root.querySelectorAll('[data-auth-tab]').forEach((tab) => {
    tab.disabled = busy;
  });
}

function announce(notify, payload) {
  if (typeof notify === 'function') notify(payload);
}

export function mountLoginView(root, { auth, navigate, notify } = {}) {
  if (!root?.querySelector) {
    throw new TypeError('Uma raiz válida é obrigatória para montar o login.');
  }

  const switchTab = (kind, focus = false) => {
    const selected = kind === 'operator' ? 'operator' : 'client';
    root.querySelectorAll('[data-auth-tab]').forEach((tab) => {
      const active = tab.dataset.authTab === selected;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    root.querySelectorAll('[data-auth-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.authPanel !== selected;
    });
    clearAuthError(root, selected);
  };

  const onClick = (event) => {
    const tab = event.target.closest('[data-auth-tab]');
    if (tab) switchTab(tab.dataset.authTab);

    const toggle = event.target.closest('[data-action="toggle-password"]');
    if (!toggle) return;
    const input = root.querySelector(`#${toggle.getAttribute('aria-controls')}`);
    if (!input) return;
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    toggle.setAttribute('aria-pressed', String(!visible));
    toggle.setAttribute('aria-label', visible ? 'Mostrar senha' : 'Ocultar senha');
    const symbol = toggle.querySelector('.material-symbols-rounded, .material-symbols-outlined');
    if (symbol) symbol.textContent = visible ? 'visibility' : 'visibility_off';
    input.focus();
  };

  const onKeyDown = (event) => {
    const current = event.target.closest('[data-auth-tab]');
    if (!current || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...root.querySelectorAll('[data-auth-tab]:not([disabled])')];
    const currentIndex = tabs.indexOf(current);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    event.preventDefault();
    switchTab(tabs[nextIndex]?.dataset.authTab, true);
  };

  const onInput = (event) => {
    if (event.target.id === 'client-cpf') {
      event.target.value = formatCpf(event.target.value);
      setFieldError(root, 'client-cpf');
      clearAuthError(root, 'client');
    }
    if (event.target.id === 'operator-email' || event.target.id === 'operator-password') {
      setFieldError(root, event.target.id);
      clearAuthError(root, 'operator');
    }
  };

  const onSubmit = async (event) => {
    const form = event.target.closest('[data-auth-form]');
    if (!form) return;
    event.preventDefault();
    const kind = form.dataset.authForm;
    clearAuthError(root, kind);
    const credentials = kind === 'operator'
      ? validateOperator(root, form)
      : validateClient(root, form);
    if (!credentials) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    const login = kind === 'operator' ? auth?.loginOperator : auth?.loginClient;
    if (typeof login !== 'function') {
      showAuthError(root, kind);
      announce(notify, { title: 'Login indisponível', message: AUTH_ERROR_MESSAGE, kind: 'error' });
      return;
    }

    setFormBusy(root, form, true, 'Entrando…');
    try {
      const session = await login(credentials);
      announce(notify, { title: 'Acesso confirmado', message: 'Bem-vindo ao AutoGestão Pro.', kind: 'success' });
      if (typeof navigate === 'function') navigate(homeRouteForRole(session?.role));
    } catch {
      showAuthError(root, kind);
      announce(notify, { title: 'Não foi possível entrar', message: AUTH_ERROR_MESSAGE, kind: 'error' });
    } finally {
      setFormBusy(root, form, false);
    }
  };

  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('input', onInput);
  root.addEventListener('submit', onSubmit);

  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('keydown', onKeyDown);
    root.removeEventListener('input', onInput);
    root.removeEventListener('submit', onSubmit);
  };
}
