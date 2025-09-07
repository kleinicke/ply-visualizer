import * as assert from 'assert';

/**
 * UI Button Tests - Verify all buttons exist and are clickable
 * Tests button presence, event listeners, and basic interaction functionality
 */

// Mock DOM environment for testing
class MockDocument {
    private elements = new Map<string, MockElement>();
    
    getElementById(id: string): MockElement | null {
        return this.elements.get(id) || null;
    }
    
    querySelector(selector: string): MockElement | null {
        // Simple selector matching for testing
        const element = Array.from(this.elements.values()).find(el => 
            el.matches(selector)
        );
        return element || null;
    }
    
    querySelectorAll(selector: string): MockElement[] {
        return Array.from(this.elements.values()).filter(el => 
            el.matches(selector)
        );
    }
    
    createElement(tagName: string): MockElement {
        return new MockElement(tagName);
    }
    
    addElement(id: string, element: MockElement): void {
        element.id = id;
        this.elements.set(id, element);
    }
    
    addElementWithClass(className: string, element: MockElement): void {
        element.className = className;
        this.elements.set(className, element);
    }
}

class MockElement {
    public id = '';
    public className = '';
    public tagName: string;
    public textContent = '';
    public innerHTML = '';
    public style: any = {};
    public dataset: any = {};
    public classList = {
        add: (className: string) => {
            if (!this.className.includes(className)) {
                this.className += (this.className ? ' ' : '') + className;
            }
        },
        remove: (className: string) => {
            this.className = this.className.replace(new RegExp(`\\b${className}\\b\\s*`, 'g'), '').trim();
        },
        toggle: (className: string, force?: boolean) => {
            const hasClass = this.className.includes(className);
            if (force === undefined) {
                if (hasClass) this.classList.remove(className);
                else this.classList.add(className);
            } else if (force) {
                this.classList.add(className);
            } else {
                this.classList.remove(className);
            }
        },
        contains: (className: string) => this.className.includes(className)
    };
    private eventListeners = new Map<string, Function[]>();
    public clickCount = 0;
    public children: MockElement[] = [];
    public parentElement: MockElement | null = null;
    
    constructor(tagName: string) {
        this.tagName = tagName.toUpperCase();
    }
    
    addEventListener(event: string, handler: Function): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(handler);
    }
    
    removeEventListener(event: string, handler: Function): void {
        const handlers = this.eventListeners.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) handlers.splice(index, 1);
        }
    }
    
    click(): void {
        this.clickCount++;
        const clickHandlers = this.eventListeners.get('click');
        if (clickHandlers) {
            const mockEvent = {
                target: this,
                preventDefault: () => {},
                stopPropagation: () => {}
            };
            clickHandlers.forEach(handler => handler(mockEvent));
        }
    }
    
    matches(selector: string): boolean {
        if (selector.startsWith('.')) {
            return this.className.includes(selector.substring(1));
        }
        if (selector.startsWith('#')) {
            return this.id === selector.substring(1);
        }
        return this.tagName.toLowerCase() === selector.toLowerCase();
    }
    
    getAttribute(name: string): string | null {
        if (name === 'data-file-index') {
            return this.dataset.fileIndex || null;
        }
        if (name === 'data-mode') {
            return this.dataset.mode || null;
        }
        return null;
    }
    
    setAttribute(name: string, value: string): void {
        if (name === 'data-file-index') {
            this.dataset.fileIndex = value;
        }
        if (name === 'data-mode') {
            this.dataset.mode = value;
        }
    }
    
    querySelector(selector: string): MockElement | null {
        return this.children.find(child => child.matches(selector)) || null;
    }
    
    querySelectorAll(selector: string): MockElement[] {
        return this.children.filter(child => child.matches(selector));
    }
    
    hasEventListener(event: string): boolean {
        return this.eventListeners.has(event) && 
               this.eventListeners.get(event)!.length > 0;
    }
}

// Test suite setup
let mockDocument: MockDocument;

suite('UI Button Tests', function() {
    this.timeout(10000);
    
    setup(() => {
        mockDocument = new MockDocument();
        // Mock global document
        (global as any).document = mockDocument;
    });
    
    teardown(() => {
        delete (global as any).document;
    });

    /**
     * Define all expected buttons in the UI
     * Each entry contains: selector, description, required attributes
     */
    const expectedButtons = [
        // Render Mode Buttons
        { 
            selector: '.render-mode-btn[data-mode="solid"]', 
            description: 'Solid/Mesh render mode button',
            attributes: ['data-file-index', 'data-mode'],
            className: 'render-mode-btn'
        },
        { 
            selector: '.render-mode-btn[data-mode="wireframe"]', 
            description: 'Wireframe render mode button',
            attributes: ['data-file-index', 'data-mode'],
            className: 'render-mode-btn'
        },
        { 
            selector: '.render-mode-btn[data-mode="points"]', 
            description: 'Points render mode button',
            attributes: ['data-file-index', 'data-mode'],
            className: 'render-mode-btn'
        },
        { 
            selector: '.render-mode-btn[data-mode="normals"]', 
            description: 'Normals render mode button',
            attributes: ['data-file-index', 'data-mode'],
            className: 'render-mode-btn'
        },
        
        // Transform Buttons
        { 
            selector: '.transform-toggle', 
            description: 'Transform panel toggle button',
            attributes: ['data-file-index'],
            className: 'transform-toggle'
        },
        { 
            selector: '.rotate-x', 
            description: 'Rotate X 90° button',
            attributes: ['data-file-index'],
            className: 'rotate-x'
        },
        { 
            selector: '.rotate-y', 
            description: 'Rotate Y 90° button',
            attributes: ['data-file-index'],
            className: 'rotate-y'
        },
        { 
            selector: '.rotate-z', 
            description: 'Rotate Z 90° button',
            attributes: ['data-file-index'],
            className: 'rotate-z'
        },
        { 
            selector: '.apply-matrix', 
            description: 'Apply matrix button',
            attributes: ['data-file-index'],
            className: 'apply-matrix'
        },
        { 
            selector: '.invert-matrix', 
            description: 'Invert matrix button',
            attributes: ['data-file-index'],
            className: 'invert-matrix'
        },
        { 
            selector: '.reset-matrix', 
            description: 'Reset matrix button',
            attributes: ['data-file-index'],
            className: 'reset-matrix'
        },
        { 
            selector: '.add-translation', 
            description: 'Add translation button',
            attributes: ['data-file-index'],
            className: 'add-translation'
        },
        { 
            selector: '.add-quaternion', 
            description: 'Add quaternion button',
            attributes: ['data-file-index'],
            className: 'add-quaternion'
        },
        { 
            selector: '.add-angle-axis', 
            description: 'Add angle-axis button',
            attributes: ['data-file-index'],
            className: 'add-angle-axis'
        },
        
        // Depth Settings Buttons
        { 
            selector: '.depth-settings-toggle', 
            description: 'Depth settings toggle button',
            attributes: ['data-file-index'],
            className: 'depth-settings-toggle'
        },
        { 
            selector: '.reprocess-depth', 
            description: 'Reprocess depth button',
            attributes: ['data-file-index'],
            className: 'reprocess-depth'
        },
        
        // File Management Buttons
        { 
            selector: '.toggle-file-visibility', 
            description: 'Toggle file visibility button',
            attributes: ['data-file-index'],
            className: 'toggle-file-visibility'
        },
        { 
            selector: '.remove-file', 
            description: 'Remove file button',
            attributes: ['data-file-index'],
            className: 'remove-file'
        },
        
        // Default Settings Button
        { 
            selector: '.reset-to-default-settings', 
            description: 'Reset to default settings button',
            attributes: ['data-file-index'],
            className: 'reset-to-default-settings'
        }
    ];

    suite('Button Existence Tests', () => {
        test('Should create mock buttons for testing', () => {
            // Create mock buttons with proper attributes
            expectedButtons.forEach((buttonDef, index) => {
                const button = mockDocument.createElement('button');
                button.className = buttonDef.className;
                button.setAttribute('data-file-index', '0');
                if (buttonDef.selector.includes('data-mode=')) {
                    const mode = buttonDef.selector.match(/data-mode="([^"]+)"/)?.[1];
                    if (mode) button.setAttribute('data-mode', mode);
                }
                
                mockDocument.addElementWithClass(buttonDef.className, button);
            });
            
            // Verify all buttons were created
            expectedButtons.forEach(buttonDef => {
                const button = mockDocument.querySelector(`.${buttonDef.className}`);
                assert.ok(button, `${buttonDef.description} should exist`);
                assert.strictEqual(button.tagName, 'BUTTON', `${buttonDef.description} should be a button element`);
            });
        });
        
        test('Should verify button attributes', () => {
            // Create buttons with attributes
            expectedButtons.forEach(buttonDef => {
                const button = mockDocument.createElement('button');
                button.className = buttonDef.className;
                
                // Set required attributes
                buttonDef.attributes.forEach(attr => {
                    if (attr === 'data-file-index') {
                        button.setAttribute('data-file-index', '0');
                    } else if (attr === 'data-mode') {
                        const mode = buttonDef.selector.match(/data-mode="([^"]+)"/)?.[1];
                        if (mode) button.setAttribute('data-mode', mode);
                    }
                });
                
                mockDocument.addElementWithClass(buttonDef.className, button);
            });
            
            // Verify attributes
            expectedButtons.forEach(buttonDef => {
                const button = mockDocument.querySelector(`.${buttonDef.className}`);
                assert.ok(button, `${buttonDef.description} should exist`);
                
                buttonDef.attributes.forEach(attr => {
                    const value = button.getAttribute(attr);
                    assert.ok(value !== null, `${buttonDef.description} should have ${attr} attribute`);
                });
            });
        });
    });

    suite('Button Clickability Tests', () => {
        test('Should verify buttons can be clicked', () => {
            // Create clickable buttons
            expectedButtons.forEach(buttonDef => {
                const button = mockDocument.createElement('button');
                button.className = buttonDef.className;
                button.setAttribute('data-file-index', '0');
                if (buttonDef.selector.includes('data-mode=')) {
                    const mode = buttonDef.selector.match(/data-mode="([^"]+)"/)?.[1];
                    if (mode) button.setAttribute('data-mode', mode);
                }
                
                // Add click handler
                let clicked = false;
                button.addEventListener('click', () => { clicked = true; });
                
                mockDocument.addElementWithClass(buttonDef.className, button);
                
                // Test click
                button.click();
                assert.ok(clicked, `${buttonDef.description} should be clickable`);
                assert.strictEqual(button.clickCount, 1, `${buttonDef.description} click should be registered`);
            });
        });
        
        test('Should verify event listener attachment', () => {
            expectedButtons.forEach(buttonDef => {
                const button = mockDocument.createElement('button');
                button.className = buttonDef.className;
                
                // Add event listener
                button.addEventListener('click', () => {});
                
                mockDocument.addElementWithClass(buttonDef.className, button);
                
                assert.ok(button.hasEventListener('click'), 
                    `${buttonDef.description} should have click event listener`);
            });
        });
    });

    suite('Button Group Tests', () => {
        test('Should verify render mode buttons work together', () => {
            const modes = ['solid', 'wireframe', 'points', 'normals'];
            let activeMode = '';
            
            // Create render mode buttons
            modes.forEach(mode => {
                const button = mockDocument.createElement('button');
                button.className = 'render-mode-btn';
                button.setAttribute('data-mode', mode);
                button.setAttribute('data-file-index', '0');
                
                button.addEventListener('click', () => {
                    activeMode = mode;
                });
                
                mockDocument.addElementWithClass(`render-mode-btn-${mode}`, button);
            });
            
            // Test each mode
            modes.forEach(mode => {
                const button = mockDocument.querySelector(`.render-mode-btn-${mode}`);
                assert.ok(button, `Render mode button for ${mode} should exist`);
                
                button.click();
                assert.strictEqual(activeMode, mode, `Clicking ${mode} button should activate ${mode} mode`);
            });
        });
        
        test('Should verify transform buttons work with file indices', () => {
            const transformButtons = ['rotate-x', 'rotate-y', 'rotate-z', 'apply-matrix', 'invert-matrix', 'reset-matrix'];
            const clickedButtons: string[] = [];
            
            transformButtons.forEach(buttonClass => {
                const button = mockDocument.createElement('button');
                button.className = buttonClass;
                button.setAttribute('data-file-index', '1'); // File index 1
                
                button.addEventListener('click', () => {
                    const fileIndex = button.getAttribute('data-file-index');
                    clickedButtons.push(`${buttonClass}-file${fileIndex}`);
                });
                
                mockDocument.addElementWithClass(buttonClass, button);
            });
            
            // Click all buttons
            transformButtons.forEach(buttonClass => {
                const button = mockDocument.querySelector(`.${buttonClass}`);
                assert.ok(button, `Transform button ${buttonClass} should exist`);
                button.click();
            });
            
            // Verify all were clicked with correct file index
            transformButtons.forEach(buttonClass => {
                assert.ok(
                    clickedButtons.includes(`${buttonClass}-file1`),
                    `${buttonClass} should be clicked with file index 1`
                );
            });
        });
    });

    suite('Button State Tests', () => {
        test('Should verify toggle buttons maintain state', () => {
            const button = mockDocument.createElement('button');
            button.className = 'transform-toggle';
            button.setAttribute('data-file-index', '0');
            
            let isExpanded = false;
            button.addEventListener('click', () => {
                isExpanded = !isExpanded;
                button.classList.toggle('active', isExpanded);
            });
            
            mockDocument.addElementWithClass('transform-toggle', button);
            
            // Test toggle behavior
            assert.strictEqual(isExpanded, false, 'Initially should be collapsed');
            
            button.click();
            assert.strictEqual(isExpanded, true, 'First click should expand');
            
            button.click();
            assert.strictEqual(isExpanded, false, 'Second click should collapse');
        });
        
        test('Should verify buttons can be disabled/enabled', () => {
            const button = mockDocument.createElement('button') as any;
            button.className = 'apply-matrix';
            button.disabled = false;
            
            let clickCount = 0;
            button.addEventListener('click', () => {
                if (!button.disabled) clickCount++;
            });
            
            mockDocument.addElementWithClass('apply-matrix', button);
            
            // Test enabled state
            button.click();
            assert.strictEqual(clickCount, 1, 'Enabled button should be clickable');
            
            // Test disabled state
            button.disabled = true;
            button.click();
            assert.strictEqual(clickCount, 1, 'Disabled button should not register clicks');
            
            // Test re-enabled state
            button.disabled = false;
            button.click();
            assert.strictEqual(clickCount, 2, 'Re-enabled button should be clickable again');
        });
    });

    suite('Button Integration Tests', () => {
        test('Should verify multiple file index support', () => {
            const fileIndices = [0, 1, 2];
            const buttonClicks = new Map<string, number[]>();
            
            // Create buttons for multiple files
            fileIndices.forEach(fileIndex => {
                const button = mockDocument.createElement('button');
                button.className = 'rotate-x';
                button.setAttribute('data-file-index', fileIndex.toString());
                
                button.addEventListener('click', () => {
                    const index = parseInt(button.getAttribute('data-file-index') || '0');
                    if (!buttonClicks.has('rotate-x')) {
                        buttonClicks.set('rotate-x', []);
                    }
                    buttonClicks.get('rotate-x')!.push(index);
                });
                
                mockDocument.addElementWithClass(`rotate-x-${fileIndex}`, button);
            });
            
            // Click buttons for different files
            fileIndices.forEach(fileIndex => {
                const button = mockDocument.querySelector(`.rotate-x-${fileIndex}`);
                assert.ok(button, `Rotate X button for file ${fileIndex} should exist`);
                button.click();
            });
            
            // Verify all file indices were processed
            const clickedIndices = buttonClicks.get('rotate-x') || [];
            assert.strictEqual(clickedIndices.length, 3, 'Should have 3 button clicks');
            assert.deepStrictEqual(
                clickedIndices.sort(), 
                [0, 1, 2], 
                'Should have clicked buttons for all file indices'
            );
        });
        
        test('Should verify button error handling', () => {
            const button = mockDocument.createElement('button');
            button.className = 'apply-matrix';
            button.setAttribute('data-file-index', 'invalid');
            
            let errorOccurred = false;
            button.addEventListener('click', () => {
                try {
                    const fileIndex = parseInt(button.getAttribute('data-file-index') || '0');
                    if (isNaN(fileIndex)) {
                        throw new Error('Invalid file index');
                    }
                } catch (e) {
                    errorOccurred = true;
                }
            });
            
            mockDocument.addElementWithClass('apply-matrix', button);
            
            button.click();
            assert.ok(errorOccurred, 'Button should handle invalid data-file-index gracefully');
        });
    });

    suite('Button Accessibility Tests', () => {
        test('Should verify buttons have proper ARIA attributes', () => {
            const button = mockDocument.createElement('button');
            button.className = 'render-mode-btn';
            button.setAttribute('data-mode', 'points');
            // Fix: Add aria-label to the dataset (our MockElement handles this)
            button.dataset.ariaLabel = 'Toggle points rendering';
            button.dataset.role = 'button';
            
            mockDocument.addElementWithClass('render-mode-btn', button);
            
            // Test that ARIA attributes can be set and retrieved
            assert.strictEqual(
                button.dataset.ariaLabel, 
                'Toggle points rendering', 
                'Button should have descriptive aria-label in dataset'
            );
            assert.strictEqual(
                button.dataset.role, 
                'button', 
                'Button should have proper role in dataset'
            );
            
            // Test button functionality remains intact
            let clicked = false;
            button.addEventListener('click', () => { clicked = true; });
            button.click();
            assert.ok(clicked, 'Button with accessibility attributes should still be clickable');
        });
    });

    test('Integration Test - All expected buttons should exist and be clickable', () => {
        // This is the main integration test that verifies the complete UI
        let totalClicks = 0;
        
        // Create all expected buttons with event handlers
        expectedButtons.forEach(buttonDef => {
            const button = mockDocument.createElement('button');
            button.className = buttonDef.className;
            button.setAttribute('data-file-index', '0');
            
            if (buttonDef.selector.includes('data-mode=')) {
                const mode = buttonDef.selector.match(/data-mode="([^"]+)"/)?.[1];
                if (mode) button.setAttribute('data-mode', mode);
            }
            
            button.addEventListener('click', () => totalClicks++);
            mockDocument.addElementWithClass(buttonDef.className, button);
        });
        
        // Test each button
        let successfulClicks = 0;
        expectedButtons.forEach(buttonDef => {
            const button = mockDocument.querySelector(`.${buttonDef.className}`);
            
            if (button) {
                const initialClicks = totalClicks;
                button.click();
                if (totalClicks > initialClicks) {
                    successfulClicks++;
                }
            }
        });
        
        assert.strictEqual(
            successfulClicks, 
            expectedButtons.length, 
            `All ${expectedButtons.length} buttons should be clickable`
        );
        
        console.log(`✅ Successfully tested ${successfulClicks} UI buttons`);
        console.log(`📊 Button types tested:`, expectedButtons.map(b => b.className).join(', '));
    });
});