/**
 * Tests for input-validator.js
 * Critical security tests - these validations prevent path traversal and injection attacks
 */

const {
  validateEmail,
  validateClientCode,
  validateBundleId,
  validateHexColor,
  validateBusinessTypeKey,
  validatePathSafe,
  validateAppleTeamId,
  validateGitUrl,
  sanitizeForShell,
  validateRequiredFields,
  validateEnvironmentVariables,
} = require('../../01-client-setup/shared/input-validator');

describe('InputValidator', () => {
  // ============================================
  // validateEmail
  // ============================================
  describe('validateEmail', () => {
    test('aceita email válido simples', () => {
      expect(validateEmail('user@example.com')).toBe('user@example.com');
    });

    test('aceita email com subdomínio', () => {
      expect(validateEmail('user@mail.example.com')).toBe('user@mail.example.com');
    });

    test('aceita email com números', () => {
      expect(validateEmail('user123@example123.com')).toBe('user123@example123.com');
    });

    test('converte para lowercase', () => {
      expect(validateEmail('User@EXAMPLE.com')).toBe('user@example.com');
    });

    test('remove espaços', () => {
      expect(validateEmail('  user@example.com  ')).toBe('user@example.com');
    });

    test('rejeita email sem @', () => {
      expect(() => validateEmail('userexample.com')).toThrow();
    });

    test('rejeita email sem domínio', () => {
      expect(() => validateEmail('user@')).toThrow();
    });

    test('rejeita string vazia', () => {
      expect(() => validateEmail('')).toThrow();
    });

    test('rejeita null', () => {
      expect(() => validateEmail(null)).toThrow();
    });

    test('rejeita undefined', () => {
      expect(() => validateEmail(undefined)).toThrow();
    });
  });

  // ============================================
  // validateClientCode - SECURITY CRITICAL
  // ============================================
  describe('validateClientCode', () => {
    // Path traversal prevention - regex rejects these patterns
    test('rejeita ../', () => {
      expect(() => validateClientCode('../malicious')).toThrow();
    });

    test('rejeita /', () => {
      expect(() => validateClientCode('path/to/evil')).toThrow();
    });

    test('rejeita \\', () => {
      expect(() => validateClientCode('path\\to\\evil')).toThrow();
    });

    test('rejeita ..', () => {
      expect(() => validateClientCode('test..client')).toThrow();
    });

    // Formato válido
    test('aceita lowercase com hífen', () => {
      expect(validateClientCode('my-client')).toBe('my-client');
    });

    test('aceita lowercase com números', () => {
      expect(validateClientCode('client123')).toBe('client123');
    });

    test('aceita apenas números e hífen', () => {
      expect(validateClientCode('123-456')).toBe('123-456');
    });

    // Formato inválido
    test('converte UPPERCASE para lowercase', () => {
      expect(validateClientCode('MY-CLIENT')).toBe('my-client');
    });

    test('rejeita espaços', () => {
      expect(() => validateClientCode('my client')).toThrow();
    });

    test('rejeita menos de 3 caracteres', () => {
      expect(() => validateClientCode('ab')).toThrow();
    });

    test('rejeita mais de 50 caracteres', () => {
      const longCode = 'a'.repeat(51);
      expect(() => validateClientCode(longCode)).toThrow();
    });

    test('rejeita caracteres especiais @', () => {
      expect(() => validateClientCode('client@test')).toThrow();
    });

    test('rejeita caracteres especiais #', () => {
      expect(() => validateClientCode('client#test')).toThrow();
    });

    test('rejeita caracteres especiais $', () => {
      expect(() => validateClientCode('client$test')).toThrow();
    });

    test('rejeita underscore (apenas hífen permitido)', () => {
      expect(() => validateClientCode('client_test')).toThrow();
    });

    test('rejeita string vazia', () => {
      expect(() => validateClientCode('')).toThrow();
    });

    test('rejeita null', () => {
      expect(() => validateClientCode(null)).toThrow();
    });
  });

  // ============================================
  // validateBundleId
  // ============================================
  describe('validateBundleId', () => {
    test('aceita com.company.app', () => {
      expect(validateBundleId('com.company.app')).toBe('com.company.app');
    });

    test('aceita br.com.empresa.app', () => {
      expect(validateBundleId('br.com.empresa.app')).toBe('br.com.empresa.app');
    });

    test('aceita bundle com números', () => {
      expect(validateBundleId('com.company123.app456')).toBe('com.company123.app456');
    });

    test('converte para lowercase', () => {
      expect(validateBundleId('COM.COMPANY.APP')).toBe('com.company.app');
    });

    test('rejeita sem ponto', () => {
      expect(() => validateBundleId('comcompanyapp')).toThrow();
    });

    test('rejeita com apenas um segmento', () => {
      expect(() => validateBundleId('app')).toThrow();
    });

    test('rejeita começando com número', () => {
      expect(() => validateBundleId('123.company.app')).toThrow();
    });

    test('rejeita caracteres especiais', () => {
      expect(() => validateBundleId('com.comp@ny.app')).toThrow();
    });

    test('rejeita string vazia', () => {
      expect(() => validateBundleId('')).toThrow();
    });
  });

  // ============================================
  // validateHexColor
  // ============================================
  describe('validateHexColor', () => {
    test('aceita #FFFFFF', () => {
      expect(validateHexColor('#FFFFFF')).toBe('#FFFFFF');
    });

    test('aceita FFFFFF sem #', () => {
      expect(validateHexColor('FFFFFF')).toBe('#FFFFFF');
    });

    test('aceita cor com alpha #FFFFFF80', () => {
      expect(validateHexColor('#FFFFFF80')).toBe('#FFFFFF80');
    });

    test('aceita lowercase', () => {
      expect(validateHexColor('#ffffff')).toBe('#ffffff');
    });

    test('aceita cor escura', () => {
      expect(validateHexColor('#000000')).toBe('#000000');
    });

    test('aceita cor com alpha sem #', () => {
      expect(validateHexColor('5D32B380')).toBe('#5D32B380');
    });

    test('rejeita cor com 5 caracteres', () => {
      expect(() => validateHexColor('#FFFFF')).toThrow();
    });

    test('aceita 7 caracteres hex (regex permite 6-8)', () => {
      // A regex /^#?[0-9A-Fa-f]{6,8}$/ permite 6, 7 ou 8 caracteres hex
      expect(validateHexColor('FFFFFF1')).toBe('#FFFFFF1');
    });

    test('rejeita cor com 5 hex chars', () => {
      expect(() => validateHexColor('FFFFF')).toThrow();
    });

    test('rejeita cor com 9 hex chars', () => {
      expect(() => validateHexColor('FFFFFFFFF')).toThrow();
    });

    test('rejeita caracteres inválidos', () => {
      expect(() => validateHexColor('#GGGGGG')).toThrow();
    });

    test('rejeita string vazia', () => {
      expect(() => validateHexColor('')).toThrow();
    });
  });

  // ============================================
  // validateBusinessTypeKey - SECURITY CRITICAL
  // ============================================
  describe('validateBusinessTypeKey', () => {
    // Path traversal prevention - regex rejects before path check
    test('rejeita ../', () => {
      expect(() => validateBusinessTypeKey('../malicious')).toThrow();
    });

    test('rejeita /', () => {
      expect(() => validateBusinessTypeKey('type/evil')).toThrow();
    });

    test('rejeita \\', () => {
      expect(() => validateBusinessTypeKey('type\\evil')).toThrow();
    });

    // Formato válido
    test('aceita coffee', () => {
      expect(validateBusinessTypeKey('coffee')).toBe('coffee');
    });

    test('aceita beer', () => {
      expect(validateBusinessTypeKey('beer')).toBe('beer');
    });

    test('aceita sportfood', () => {
      expect(validateBusinessTypeKey('sportfood')).toBe('sportfood');
    });

    test('aceita com underscore', () => {
      expect(validateBusinessTypeKey('fast_food')).toBe('fast_food');
    });

    test('aceita com números', () => {
      expect(validateBusinessTypeKey('type123')).toBe('type123');
    });

    // Formato inválido
    test('rejeita começando com número', () => {
      expect(() => validateBusinessTypeKey('123type')).toThrow();
    });

    test('rejeita com hífen', () => {
      expect(() => validateBusinessTypeKey('fast-food')).toThrow();
    });

    test('rejeita caracteres especiais', () => {
      expect(() => validateBusinessTypeKey('type@food')).toThrow();
    });

    test('rejeita string vazia', () => {
      expect(() => validateBusinessTypeKey('')).toThrow();
    });
  });

  // ============================================
  // validatePathSafe - SECURITY CRITICAL
  // ============================================
  describe('validatePathSafe', () => {
    test('rejeita ../', () => {
      expect(() => validatePathSafe('../malicious')).toThrow('path traversal');
    });

    test('rejeita /', () => {
      expect(() => validatePathSafe('path/to/file')).toThrow('path traversal');
    });

    test('rejeita \\', () => {
      expect(() => validatePathSafe('path\\to\\file')).toThrow('path traversal');
    });

    test('aceita nome simples', () => {
      expect(validatePathSafe('filename')).toBe('filename');
    });

    test('aceita com hífen', () => {
      expect(validatePathSafe('file-name')).toBe('file-name');
    });

    test('aceita com underscore', () => {
      expect(validatePathSafe('file_name')).toBe('file_name');
    });

    test('aceita com números', () => {
      expect(validatePathSafe('file123')).toBe('file123');
    });

    test('rejeita espaços', () => {
      expect(() => validatePathSafe('file name')).toThrow();
    });

    test('rejeita caracteres especiais', () => {
      expect(() => validatePathSafe('file@name')).toThrow();
    });
  });

  // ============================================
  // validateAppleTeamId
  // ============================================
  describe('validateAppleTeamId', () => {
    test('aceita ID válido de 10 caracteres', () => {
      expect(validateAppleTeamId('ABC123DEF4')).toBe('ABC123DEF4');
    });

    test('converte para uppercase', () => {
      expect(validateAppleTeamId('abc123def4')).toBe('ABC123DEF4');
    });

    test('rejeita menos de 10 caracteres', () => {
      expect(() => validateAppleTeamId('ABC123')).toThrow();
    });

    test('rejeita mais de 10 caracteres', () => {
      expect(() => validateAppleTeamId('ABC123DEF45')).toThrow();
    });

    test('rejeita caracteres especiais', () => {
      expect(() => validateAppleTeamId('ABC@23DEF4')).toThrow();
    });

    test('rejeita string vazia', () => {
      expect(() => validateAppleTeamId('')).toThrow();
    });
  });

  // ============================================
  // validateGitUrl
  // ============================================
  describe('validateGitUrl', () => {
    test('aceita URL HTTPS .git', () => {
      expect(validateGitUrl('https://github.com/org/repo.git')).toBe(
        'https://github.com/org/repo.git'
      );
    });

    test('aceita URL SSH', () => {
      expect(validateGitUrl('git@github.com:org/repo.git')).toBe('git@github.com:org/repo.git');
    });

    test('aceita URL GitLab SSH', () => {
      expect(validateGitUrl('git@gitlab.com:org/repo.git')).toBe('git@gitlab.com:org/repo.git');
    });

    test('aceita URL HTTPS sem .git (passado para URL parser)', () => {
      // A implementação atual aceita URLs válidas mesmo sem .git
      expect(validateGitUrl('https://github.com/org/repo')).toBe('https://github.com/org/repo');
    });

    test('rejeita URL HTTP (não seguro)', () => {
      // HTTP é rejeitado - apenas HTTPS e SSH são permitidos
      expect(() => validateGitUrl('http://github.com/org/repo.git')).toThrow();
    });

    test('rejeita string aleatória', () => {
      expect(() => validateGitUrl('not-a-url')).toThrow();
    });

    test('rejeita string vazia', () => {
      expect(() => validateGitUrl('')).toThrow();
    });
  });

  // ============================================
  // sanitizeForShell - SECURITY CRITICAL
  // ============================================
  describe('sanitizeForShell', () => {
    test('remove ; (command injection)', () => {
      expect(sanitizeForShell('value; rm -rf /')).toBe('value rm -rf /');
    });

    test('remove | (pipe)', () => {
      expect(sanitizeForShell('value | cat /etc/passwd')).toBe('value  cat /etc/passwd');
    });

    test('remove $() (command substitution)', () => {
      expect(sanitizeForShell('value $(whoami)')).toBe('value whoami');
    });

    test('remove backticks', () => {
      expect(sanitizeForShell('value `whoami`')).toBe('value whoami');
    });

    test('remove &&', () => {
      expect(sanitizeForShell('value && rm -rf /')).toBe('value  rm -rf /');
    });

    test('remove { } (brace expansion)', () => {
      expect(sanitizeForShell('value {1,2,3}')).toBe('value 1,2,3');
    });

    test('remove [ ] (brackets)', () => {
      expect(sanitizeForShell('value [test]')).toBe('value test');
    });

    test('remove < > (redirection)', () => {
      expect(sanitizeForShell('value < /etc/passwd > /tmp/out')).toBe('value  /etc/passwd  /tmp/out');
    });

    test('remove \\ (escape)', () => {
      expect(sanitizeForShell('value\\n')).toBe('valuen');
    });

    test('mantém caracteres seguros', () => {
      expect(sanitizeForShell('my-safe_value123')).toBe('my-safe_value123');
    });

    test('retorna string vazia para null', () => {
      expect(sanitizeForShell(null)).toBe('');
    });

    test('retorna string vazia para undefined', () => {
      expect(sanitizeForShell(undefined)).toBe('');
    });
  });

  // ============================================
  // validateRequiredFields
  // ============================================
  describe('validateRequiredFields', () => {
    test('passa se todos campos presentes', () => {
      const obj = { name: 'test', email: 'test@test.com' };
      expect(() => validateRequiredFields(obj, ['name', 'email'])).not.toThrow();
    });

    test('detecta campo faltando', () => {
      const obj = { name: 'test' };
      expect(() => validateRequiredFields(obj, ['name', 'email'])).toThrow('email');
    });

    test('detecta múltiplos campos faltando', () => {
      const obj = {};
      expect(() => validateRequiredFields(obj, ['name', 'email'])).toThrow();
    });

    test('rejeita null como objeto', () => {
      expect(() => validateRequiredFields(null, ['name'])).toThrow();
    });

    test('rejeita undefined como objeto', () => {
      expect(() => validateRequiredFields(undefined, ['name'])).toThrow();
    });

    test('considera valor vazio como ausente', () => {
      const obj = { name: '' };
      // String vazia é considerada falsy, então o campo é tratado como ausente
      expect(() => validateRequiredFields(obj, ['name'])).toThrow();
    });

    test('considera valor 0 como ausente', () => {
      const obj = { count: 0 };
      // 0 é falsy, então é tratado como ausente
      expect(() => validateRequiredFields(obj, ['count'])).toThrow();
    });
  });

  // ============================================
  // validateEnvironmentVariables
  // ============================================
  describe('validateEnvironmentVariables', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    test('passa se variáveis existem', () => {
      process.env.TEST_VAR = 'value';
      expect(() => validateEnvironmentVariables(['TEST_VAR'])).not.toThrow();
    });

    test('detecta variável faltando', () => {
      delete process.env.MISSING_VAR;
      expect(() => validateEnvironmentVariables(['MISSING_VAR'])).toThrow('MISSING_VAR');
    });

    test('detecta variável vazia', () => {
      process.env.EMPTY_VAR = '';
      expect(() => validateEnvironmentVariables(['EMPTY_VAR'])).toThrow('EMPTY_VAR');
    });

    test('detecta variável com apenas espaços', () => {
      process.env.WHITESPACE_VAR = '   ';
      expect(() => validateEnvironmentVariables(['WHITESPACE_VAR'])).toThrow('WHITESPACE_VAR');
    });
  });
});
