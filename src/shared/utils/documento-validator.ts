/**
 * CPF/CNPJ Validator and Formatter
 *
 * Baseado no projeto cnpj-cpf-validator de Frederico Ferreira.
 * Código adaptado e embutido neste projeto por não estar disponível no npm.
 *
 * ---------------------------------------------------------------------------
 * MIT License
 *
 * Copyright (c) Frederico Ferreira
 * https://github.com/FredericoSFerreira/cnpj-cpf-validator
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * ---------------------------------------------------------------------------
 *
 * Suporte a formatos de CNPJ:
 * - CNPJ numérico tradicional (14 dígitos): XX.XXX.XXX/XXXX-XX
 * - Novo CNPJ alfanumérico (vigente a partir de julho/2026):
 *   - 14 caracteres no total
 *   - Primeiras 12 posições podem conter letras e números
 *   - Últimas 2 posições (dígitos verificadores) permanecem numéricas
 *   - Exemplo: A1B2.C3D4.E5F6/G7H8-01
 *
 * A biblioteca detecta automaticamente qual formato está sendo usado
 * e aplica as regras de validação correspondentes.
 */

/**
 * Remove todos os caracteres não numéricos de uma string.
 * @param value - String a ser limpa.
 * @returns String contendo apenas números.
 */
export function cleanNumbers(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Remove todos os caracteres não alfanuméricos de uma string.
 * @param value - String a ser limpa.
 * @returns String contendo apenas letras e números.
 */
export function cleanAlphanumeric(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '');
}

// ══════════════════════════════════════════════════════════════════════════════
// CPF
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Valida se um CPF é matematicamente correto.
 * Aceita entrada formatada (XXX.XXX.XXX-XX) ou apenas dígitos.
 * @param cpf - CPF a ser validado.
 * @returns `true` se o CPF for válido, `false` caso contrário.
 */
export function isValidCPF(cpf: string): boolean {
  const cleanCPF = cleanNumbers(cpf);

  if (cleanCPF.length !== 11) return false;

  // CPFs com todos os dígitos iguais são inválidos (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;

  if (parseInt(cleanCPF.charAt(9)) !== digit1) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;

  return parseInt(cleanCPF.charAt(10)) === digit2;
}

/**
 * Formata um CPF com a máscara padrão (XXX.XXX.XXX-XX).
 * @param cpf - CPF a ser formatado.
 * @returns CPF formatado ou string vazia se inválido.
 */
export function formatCPF(cpf: string): string {
  const cleanCPF = cleanNumbers(cpf);
  if (cleanCPF.length !== 11) return '';
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Remove a formatação de um CPF, retornando apenas os 11 dígitos.
 * @param cpf - CPF com ou sem formatação.
 * @returns String com apenas os dígitos do CPF.
 */
export function cleanCPF(cpf: string): string {
  return cleanNumbers(cpf);
}

// ══════════════════════════════════════════════════════════════════════════════
// CNPJ
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Converte um caractere para seu valor numérico no cálculo do dígito verificador do CNPJ.
 * Conforme documentação da Receita Federal e Serpro: valor = código ASCII − 48.
 * @param char - Caractere a ser convertido.
 * @returns Valor numérico do caractere.
 */
function getCharValue(char: string): number {
  return char.charCodeAt(0) - 48;
}

/**
 * Verifica se um CNPJ (já limpo) está no novo formato alfanumérico.
 * @param cnpj - String CNPJ limpa.
 * @returns `true` se o CNPJ contiver letras.
 */
export function isAlphanumericCNPJ(cnpj: string): boolean {
  return /[a-zA-Z]/.test(cnpj);
}

/**
 * Valida se um CNPJ é matematicamente correto.
 * Suporta tanto o formato numérico tradicional quanto o novo formato alfanumérico (julho/2026).
 * Aceita entrada formatada ou sem formatação.
 * @param cnpj - CNPJ a ser validado.
 * @returns `true` se o CNPJ for válido, `false` caso contrário.
 */
export function isValidCNPJ(cnpj: string): boolean {
  const hasLetters = /[a-zA-Z]/.test(cnpj);
  const cleanCNPJ = hasLetters ? cleanAlphanumeric(cnpj) : cleanNumbers(cnpj);

  if (cleanCNPJ.length !== 14) return false;

  // CNPJs numéricos com todos os dígitos iguais são inválidos
  if (!hasLetters && /^(\d)\1{13}$/.test(cleanCNPJ)) return false;

  // No formato alfanumérico, os 2 últimos caracteres devem ser dígitos verificadores numéricos
  if (hasLetters && !/\d{2}$/.test(cleanCNPJ)) return false;

  const digits = cleanCNPJ.substring(12); // 2 dígitos verificadores

  // Cálculo do 1º dígito verificador (pesos 5,4,3,2,9,8,7,6,5,4,3,2)
  let size = 12;
  let numbers = cleanCNPJ.substring(0, size);
  let sum = 0;
  let weight = 2;

  for (let i = size - 1; i >= 0; i--) {
    const charValue = hasLetters ? getCharValue(numbers.charAt(i)) : parseInt(numbers.charAt(i));
    sum += charValue * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  let remainder = sum % 11;
  let result = remainder < 2 ? 0 : 11 - remainder;
  if (result !== parseInt(digits.charAt(0))) return false;

  // Cálculo do 2º dígito verificador (inclui o 1º dígito verificador)
  size = 13;
  numbers = cleanCNPJ.substring(0, size);
  sum = 0;
  weight = 2;

  for (let i = size - 1; i >= 0; i--) {
    const charValue = hasLetters ? getCharValue(numbers.charAt(i)) : parseInt(numbers.charAt(i));
    sum += charValue * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  remainder = sum % 11;
  result = remainder < 2 ? 0 : 11 - remainder;

  return result === parseInt(digits.charAt(1));
}

/**
 * Formata um CNPJ com a máscara padrão (XX.XXX.XXX/XXXX-XX).
 * Funciona tanto para o formato numérico quanto para o alfanumérico.
 * @param cnpj - CNPJ a ser formatado.
 * @returns CNPJ formatado ou string vazia se inválido.
 */
export function formatCNPJ(cnpj: string): string {
  const hasLetters = /[a-zA-Z]/.test(cnpj);
  const cleanCNPJ = hasLetters ? cleanAlphanumeric(cnpj) : cleanNumbers(cnpj);
  if (cleanCNPJ.length !== 14) return '';
  return cleanCNPJ.replace(/(.{2})(.{3})(.{3})(.{4})(.{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Remove a formatação de um CNPJ.
 * Para CNPJ numérico: remove caracteres não numéricos.
 * Para CNPJ alfanumérico: remove caracteres não alfanuméricos (preserva letras).
 * @param cnpj - CNPJ com ou sem formatação.
 * @returns String limpa do CNPJ.
 */
export function cleanCNPJ(cnpj: string): string {
  const hasLetters = /[a-zA-Z]/.test(cnpj);
  return hasLetters ? cleanAlphanumeric(cnpj) : cleanNumbers(cnpj);
}

// ══════════════════════════════════════════════════════════════════════════════
// Funções combinadas (CPF ou CNPJ)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Valida se um documento é um CPF ou CNPJ válido.
 * Detecta automaticamente o tipo com base no tamanho e presença de letras.
 * @param document - Documento a ser validado (formatado ou só dígitos/letras).
 * @returns `true` se for um CPF ou CNPJ válido.
 */
export function isValidDocument(document: string): boolean {
  const hasLetters = /[a-zA-Z]/.test(document);

  if (hasLetters) {
    const clean = cleanAlphanumeric(document);
    return clean.length === 14 ? isValidCNPJ(document) : false;
  }

  const clean = cleanNumbers(document);
  if (clean.length === 11) return isValidCPF(clean);
  if (clean.length === 14) return isValidCNPJ(clean);
  return false;
}

/**
 * Formata um documento como CPF ou CNPJ com base em suas características.
 * @param document - Documento a ser formatado.
 * @returns Documento formatado ou string vazia se inválido/não reconhecido.
 */
export function formatDocument(document: string): string {
  const hasLetters = /[a-zA-Z]/.test(document);

  if (hasLetters) {
    const clean = cleanAlphanumeric(document);
    return clean.length === 14 ? formatCNPJ(document) : '';
  }

  const clean = cleanNumbers(document);
  if (clean.length === 11) return formatCPF(clean);
  if (clean.length === 14) return formatCNPJ(clean);
  return '';
}
