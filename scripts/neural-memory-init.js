/**
 * Neural Memory Auto-Installer
 *
 * Automatically checks and installs neural-memory package when Dyad launches.
 * This ensures the neural_memory tool is always available in Build mode.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function checkNeuralMemory() {
  try {
    // Check if nmem command is available
    await execAsync('nmem --help', { timeout: 5000 });
    console.log('[NeuralMemory] ✓ Already installed');
    return true;
  } catch (error) {
    console.log('[NeuralMemory] Not found - installing...');
    return false;
  }
}

async function installNeuralMemory() {
  try {
    console.log('[NeuralMemory] Installing neural-memory package...');

    // Install via pip
    const { stdout, stderr } = await execAsync('pip install neural-memory', {
      timeout: 120000, // 2 minutes
    });

    console.log('[NeuralMemory] ✓ Installation successful');
    if (stdout) console.log(stdout);

    return true;
  } catch (error) {
    console.error('[NeuralMemory] ✗ Installation failed:', error.message);
    return false;
  }
}

async function initNeuralMemory() {
  try {
    // Check if already initialized (has brain)
    try {
      const { stdout } = await execAsync('nmem status', { timeout: 5000 });
      if (stdout.includes('Brain:')) {
        console.log('[NeuralMemory] ✓ Already initialized');
        return true;
      }
    } catch (e) {
      // Not initialized yet
    }

    console.log('[NeuralMemory] Initializing default brain...');

    // Initialize
    await execAsync('nmem init --no-mcp', { timeout: 30000 });

    console.log('[NeuralMemory] ✓ Initialization complete');
    return true;
  } catch (error) {
    console.error('[NeuralMemory] ✗ Initialization failed:', error.message);
    return false;
  }
}

async function setupNeuralMemory() {
  console.log('[NeuralMemory] Checking neural-memory setup...');

  // Step 1: Check if installed
  const isInstalled = await checkNeuralMemory();

  // Step 2: Install if needed
  if (!isInstalled) {
    const installed = await installNeuralMemory();
    if (!installed) {
      console.error('[NeuralMemory] ✗ Setup failed - neural_memory tool will not be available');
      return false;
    }
  }

  // Step 3: Initialize if needed
  const initialized = await initNeuralMemory();
  if (!initialized) {
    console.warn('[NeuralMemory] ⚠ Initialization incomplete - tool may not work correctly');
    return false;
  }

  console.log('[NeuralMemory] ✓ Setup complete - neural_memory tool ready!');
  return true;
}

// Export for use in main process
module.exports = { setupNeuralMemory };

// Allow running standalone
if (require.main === module) {
  setupNeuralMemory()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('[NeuralMemory] Fatal error:', error);
      process.exit(1);
    });
}
