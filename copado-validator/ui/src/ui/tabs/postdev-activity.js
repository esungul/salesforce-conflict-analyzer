// ui/src/ui/tabs/postdev-activity.js
import { createFilterBar } from '../components/filterBar.js';
import { createStatusBadge } from '../components/statusBadge.js';

const $ = (s, r = document) => r.querySelector(s);


let POSTDEV_STATE = {
    query: localStorage.getItem('ui.postdev.query') || '',
    sort: localStorage.getItem('ui.postdev.sort') || 'name',
    selectedComponents: JSON.parse(localStorage.getItem('ui.postdev.selected') || '[]'),
    selectedManualComponents: JSON.parse(localStorage.getItem('ui.postdev.selectedManual') || '[]'),
    manualComponents: JSON.parse(localStorage.getItem('ui.postdev.manual') || '[]')
};



export function renderPostDevActivityTab(analysis = {}) {
    const panel = $('#tab-postdev-activity');
    if (!panel) return;

    panel.innerHTML = '';
    
    const header = createElement('div', { className: 'section-header' }, [
        createElement('h2', {}, 'PostDev Activity Analysis'),
        createElement('p', { className: 'muted' }, 'Validate OmniScript and Product2 components from analysis or manual input')
    ]);
    panel.append(header);

    // Main content grid
    const contentGrid = createElement('div', { className: 'postdev-grid' });
    
    // Left panel: Component extraction from analysis
    const extractionPanel = createExtractionPanel(analysis);
    contentGrid.append(extractionPanel);
    
    // Right panel: Manual input and actions
    const manualPanel = createManualInputPanel();
    contentGrid.append(manualPanel);
    
    panel.append(contentGrid);
    injectPostDevStyles();
}


function createExtractionPanel(analysis) {
    const panel = createElement('div', { className: 'extraction-panel' });
    
    const header = createElement('div', { className: 'panel-header' }, [
        createElement('h3', {}, '📊 Extract from Analysis'),
        createElement('p', { className: 'panel-subtitle' }, 'Automatically extract OmniScript and Product2 components from current analysis')
    ]);
    panel.append(header);

    const components = extractComponentsFromAnalysis(analysis);
    
    if (components.length === 0) {
        panel.append(createElement('div', { className: 'empty-state' }, [
            createElement('p', {}, 'No analysis data available or no OmniScript/Product2 components found.'),
            createElement('button', { 
                className: 'btn btn-primary',
                onclick: () => {
                    const analyzeBtn = document.querySelector('[data-tab="overview"]');
                    if (analyzeBtn) analyzeBtn.click();
                    if (window.openAnalyzeModal) window.openAnalyzeModal();
                }
            }, 'Run Analysis First')
        ]));
        return panel;
    }

    // Stats summary
    const stats = createElement('div', { className: 'extraction-stats' });
    const omniscripCount = components.filter(c => c.type === 'OmniScript').length;
    const productCount = components.filter(c => c.type === 'Product2').length;
    
    stats.innerHTML = `
        <div class="stat-item">
            <span class="stat-value">${components.length}</span>
            <span class="stat-label">Total Components</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${omniscripCount}</span>
            <span class="stat-label">OmniScripts</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${productCount}</span>
            <span class="stat-label">Products</span>
        </div>
    `;
    panel.append(stats);

    // Filter bar for extracted components
    const filterBar = createFilterBar({
        query: POSTDEV_STATE.query,
        onQueryChange: (q) => {
            POSTDEV_STATE.query = q;
            localStorage.setItem('ui.postdev.query', q);
            renderPostDevActivityTab(analysis);
        },
        sort: POSTDEV_STATE.sort,
        onSortChange: (s) => {
            POSTDEV_STATE.sort = s;
            localStorage.setItem('ui.postdev.sort', s);
            renderPostDevActivityTab(analysis);
        },
        sortOptions: [
            { value: 'name', label: 'Component Name' },
            { value: 'type', label: 'Component Type' },
            { value: 'count', label: 'Occurrences' }
        ]
    });
    panel.append(filterBar);

    // Components list
    const componentsList = createElement('div', { className: 'components-list' });
    
    let filteredComponents = components.filter(comp => 
        comp.name.toLowerCase().includes(POSTDEV_STATE.query.toLowerCase()) ||
        comp.type.toLowerCase().includes(POSTDEV_STATE.query.toLowerCase()) ||
        comp.fullName.toLowerCase().includes(POSTDEV_STATE.query.toLowerCase())
    );

    // Sort components
    filteredComponents.sort((a, b) => {
        switch (POSTDEV_STATE.sort) {
            case 'type':
                return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
            case 'count':
                return b.count - a.count || a.name.localeCompare(b.name);
            default:
                return a.name.localeCompare(b.name);
        }
    });

    if (filteredComponents.length === 0) {
        componentsList.append(createElement('div', { className: 'empty-card' }, [
            createElement('p', {}, 'No components match your search criteria')
        ]));
    } else {
        filteredComponents.forEach(component => {
            componentsList.append(createComponentCard(component, analysis));
        });
    }

    panel.append(componentsList);

    // Initialize selection UI after components are rendered
    setTimeout(updateSelectionUI, 0);

    // Bulk actions
    const selectedCount = POSTDEV_STATE.selectedComponents.length;
    const bulkActions = createElement('div', { className: 'bulk-actions' }, [
        createElement('button', { 
            className: 'btn btn-primary',
            onclick: () => {
                const selected = filteredComponents.filter(comp => 
                    POSTDEV_STATE.selectedComponents.includes(comp.fullName)
                );
                if (selected.length === 0) {
                    alert('Please select at least one component');
                    return;
                }
                runPostDevAnalysis(selected);
            }
        }, `🔍 Validate Selected (${selectedCount})`),
        createElement('button', { 
            className: 'btn btn-export',
            onclick: () => {
                const selected = filteredComponents.filter(comp => 
                    POSTDEV_STATE.selectedComponents.includes(comp.fullName)
                );
                if (selected.length === 0) {
                    alert('Please select at least one component');
                    return;
                }
                exportSelectedComponentsToCSV(selected);
            }
        }, `📊 Export Selected (${selectedCount})`),
        createElement('button', { 
            className: 'btn btn-secondary',
            onclick: () => {
                const allSelected = filteredComponents.every(comp => 
                    POSTDEV_STATE.selectedComponents.includes(comp.fullName)
                );
                
                if (allSelected) {
                    // Deselect all
                    POSTDEV_STATE.selectedComponents = POSTDEV_STATE.selectedComponents.filter(
                        name => !filteredComponents.some(comp => comp.fullName === name)
                    );
                } else {
                    // Select all
                    filteredComponents.forEach(comp => {
                        if (!POSTDEV_STATE.selectedComponents.includes(comp.fullName)) {
                            POSTDEV_STATE.selectedComponents.push(comp.fullName);
                        }
                    });
                }
                localStorage.setItem('ui.postdev.selected', JSON.stringify(POSTDEV_STATE.selectedComponents));
                updateSelectionUI();
            }
        }, selectedCount === filteredComponents.length ? 'Deselect All' : 'Select All'),
        createElement('button', { 
            className: 'btn btn-secondary',
            onclick: () => {
                POSTDEV_STATE.selectedComponents = [];
                localStorage.setItem('ui.postdev.selected', JSON.stringify([]));
                updateSelectionUI();
            }
        }, 'Clear Selection')
    ]);
    panel.append(bulkActions);

    return panel;
}

function updateSelectionUI() {
    // Update the bulk actions button text
    const selectedCount = POSTDEV_STATE.selectedComponents.length;
    const validateButton = document.querySelector('.bulk-actions .btn-primary');
    if (validateButton) {
        validateButton.textContent = `🔍 Validate Selected (${selectedCount})`;
    }
    
    // Update the select all button text
    const selectAllButton = document.querySelector('.bulk-actions .btn-secondary:nth-child(2)');
    if (selectAllButton) {
        const componentsList = document.querySelector('.components-list');
        const totalComponents = componentsList ? componentsList.children.length : 0;
        const allSelected = selectedCount === totalComponents && totalComponents > 0;
        selectAllButton.textContent = allSelected ? 'Deselect All' : 'Select All';
    }
    
    // Update the visual selection state of component cards
    document.querySelectorAll('.component-card').forEach(card => {
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox) {
            // Extract the fullName from the onchange attribute
            const onchangeAttr = checkbox.getAttribute('onchange');
            if (onchangeAttr) {
                const match = onchangeAttr.match(/'([^']+)'/);
                if (match) {
                    const fullName = match[1];
                    const isSelected = POSTDEV_STATE.selectedComponents.includes(fullName);
                    
                    if (isSelected) {
                        card.classList.add('selected');
                        checkbox.checked = true;
                    } else {
                        card.classList.remove('selected');
                        checkbox.checked = false;
                    }
                }
            }
        }
    });
}


function createManualInputPanel() {
    const panel = createElement('div', { className: 'manual-panel' });
    
    const header = createElement('div', { className: 'panel-header' }, [
        createElement('h3', {}, '✏️ Manual Input'),
        createElement('p', { className: 'panel-subtitle' }, 'Enter component details manually for validation')
    ]);
    panel.append(header);

    // Manual input form
    const form = createElement('form', { className: 'manual-form' }, [
        createElement('div', { className: 'form-group' }, [
            createElement('label', { htmlFor: 'component-type' }, 'Component Type *'),
            createElement('select', { 
                id: 'component-type',
                className: 'form-select',
                required: true
            }, [
                createElement('option', { value: '' }, 'Select Type'),
                createElement('option', { value: 'OmniScript' }, 'OmniScript'),
                createElement('option', { value: 'Product2' }, 'Product2')
            ])
        ]),
        createElement('div', { className: 'form-group' }, [
            createElement('label', { htmlFor: 'component-name' }, 'Component Name *'),
            createElement('input', { 
                type: 'text',
                id: 'component-name',
                className: 'form-input',
                placeholder: 'e.g., PR_TermsAndConditionRefactorPostpaid or Liberty U-Pick Mobile Tablet',
                required: true
            })
        ]),
        createElement('div', { className: 'form-actions' }, [
            createElement('button', { 
                type: 'button',
                className: 'btn btn-primary',
                onclick: addManualComponent
            }, 'Add Component'),
            createElement('button', { 
                type: 'button',
                className: 'btn btn-secondary',
                onclick: runManualAnalysis
            }, 'Validate All Manual')
        ])
    ]);
    panel.append(form);

    // Manual components list with bulk actions
    const manualList = createElement('div', { className: 'manual-list' }, [
        createElement('div', { className: 'manual-list-header' }, [
            createElement('h4', {}, `Manual Components (${POSTDEV_STATE.manualComponents.length})`),
            createElement('div', { className: 'manual-bulk-actions' }, [
                createElement('button', { 
                    className: 'btn btn-sm btn-primary',
                    onclick: () => validateSelectedManualComponents()
                }, `🔍 Validate Selected`),
                createElement('button', { 
                    className: 'btn btn-sm btn-secondary',
                    onclick: () => toggleSelectAllManualComponents()
                }, 'Select All'),
                createElement('button', { 
                    className: 'btn btn-sm btn-secondary',
                    onclick: () => clearManualSelection()
                }, 'Clear Selection')
            ])
        ]),
        createElement('div', { id: 'manual-components-list', className: 'components-list manual-components-list' })
    ]);
    panel.append(manualList);

    // Load existing manual components
    setTimeout(() => {
        renderManualComponentsList();
    }, 0);

    return panel;
}


function extractComponentsFromAnalysis(analysis) {
    const componentsMap = new Map();
    
    if (!analysis.all_stories || !Array.isArray(analysis.all_stories)) {
        return [];
    }

    analysis.all_stories.forEach(story => {
        if (story.components && Array.isArray(story.components)) {
            story.components.forEach(comp => {
                if (comp.api_name) {
                    const [type, ...nameParts] = comp.api_name.split('.');
                    
                    if (type === 'OmniScript' || type === 'Product2') {
                        let name = nameParts.join('.');
                        let displayName = name;
                        
                        // For OmniScript, remove the language suffix
                        if (type === 'OmniScript') {
                            const nameParts = name.split('_');
                            if (nameParts.length > 1) {
                                // Remove the last part (language)
                                nameParts.pop();
                                displayName = nameParts.join('_');
                            }
                        }
                        
                        // For Product2, clean up the name
                        if (type === 'Product2') {
                            displayName = cleanProductName(name);
                        }
                        
                        const fullName = comp.api_name;
                        const key = `${type}-${displayName}`;
                        
                        if (componentsMap.has(key)) {
                            const existing = componentsMap.get(key);
                            existing.count++;
                            if (!existing.storyIds.includes(story.story_id)) {
                                existing.storyIds.push(story.story_id);
                            }
                        } else {
                            componentsMap.set(key, {
                                type,
                                name: displayName,
                                fullName,
                                count: 1,
                                storyIds: [story.story_id],
                                rawName: name
                            });
                        }
                    }
                }
            });
        }
    });

    return Array.from(componentsMap.values());
}

// Helper function to clean Product2 names
function cleanProductName(productName) {
    let cleanedName = productName;
    
    // Remove everything after %28 (URL-encoded '(')
    const percent28Index = cleanedName.indexOf('%28');
    if (percent28Index !== -1) {
        cleanedName = cleanedName.substring(0, percent28Index);
    }
    
    // Also check for regular parentheses as backup
    const parenIndex = cleanedName.indexOf('(');
    if (parenIndex !== -1) {
        cleanedName = cleanedName.substring(0, parenIndex);
    }
    
    // Trim any extra spaces, dashes, or other punctuation
    cleanedName = cleanedName.replace(/[\s\-_]+$/, '').trim();
    
    // Try to decode any URL-encoded characters
    try {
        cleanedName = decodeURIComponent(cleanedName);
    } catch (e) {
        // If URL decoding fails, try alternative approaches
        console.log('URL decode failed, using alternative cleaning for:', cleanedName);
        
        // Replace common URL-encoded sequences
        cleanedName = cleanedName
            .replace(/%20/g, ' ')  // Spaces
            .replace(/%2C/g, ',')  // Commas
            .replace(/%2F/g, '/')  // Forward slashes
            .replace(/%3A/g, ':')  // Colons
            .replace(/%2B/g, '+')  // Plus signs
            .replace(/%26/g, '&')  // Ampersands
            .replace(/%3F/g, '?')  // Question marks
            .replace(/%3D/g, '=')  // Equals signs
            .trim();
    }
    
    return cleanedName;
}

function createComponentCard(component, analysis) {
    const card = createElement('div', { 
        className: `component-card ${POSTDEV_STATE.selectedComponents.includes(component.fullName) ? 'selected' : ''}` 
    });

    const isSelected = POSTDEV_STATE.selectedComponents.includes(component.fullName);
    
    card.innerHTML = `
        <div class="component-header">
            <div class="component-checkbox">
                <input 
                    type="checkbox" 
                    ${isSelected ? 'checked' : ''}
                    onchange="toggleComponentSelection('${component.fullName}', this.checked)"
                >
            </div>
            <div class="component-type-badge ${component.type.toLowerCase()}">
                ${component.type}
            </div>
            <div class="component-count">
                ${component.count} ${component.count === 1 ? 'story' : 'stories'}
            </div>
        </div>
        <div class="component-name">${escapeHtml(component.name)}</div>
        <div class="component-fullname">${escapeHtml(component.fullName)}</div>
        <div class="component-stories">
            <small>Found in: ${component.storyIds.slice(0, 2).map(id => `<span class="story-id">${id}</span>`).join(', ')}${component.storyIds.length > 2 ? ` and ${component.storyIds.length - 2} more` : ''}</small>
        </div>
        <div class="component-actions">
            <button class="btn btn-sm btn-primary" onclick="validateSingleComponent('${component.fullName}', '${component.type}', '${component.name}')">
                Validate
            </button>
            <button class="btn btn-sm btn-secondary" onclick="addToManualComponents('${component.type}', '${component.name}', '${component.fullName}')">
                Add to Manual
            </button>
        </div>
    `;

    return card;
}

// Manual Component Selection Functions
function toggleManualComponentSelection(fullName, isSelected) {
    if (!POSTDEV_STATE.selectedManualComponents) {
        POSTDEV_STATE.selectedManualComponents = [];
    }
    
    if (isSelected) {
        if (!POSTDEV_STATE.selectedManualComponents.includes(fullName)) {
            POSTDEV_STATE.selectedManualComponents.push(fullName);
        }
    } else {
        POSTDEV_STATE.selectedManualComponents = POSTDEV_STATE.selectedManualComponents.filter(name => name !== fullName);
    }
    
    localStorage.setItem('ui.postdev.selectedManual', JSON.stringify(POSTDEV_STATE.selectedManualComponents));
    renderManualComponentsList();
}

function toggleSelectAllManualComponents() {
    if (!POSTDEV_STATE.selectedManualComponents) {
        POSTDEV_STATE.selectedManualComponents = [];
    }
    
    const allSelected = POSTDEV_STATE.manualComponents.every(comp => 
        POSTDEV_STATE.selectedManualComponents.includes(comp.fullName)
    );
    
    if (allSelected) {
        // Deselect all manual components
        POSTDEV_STATE.selectedManualComponents = [];
    } else {
        // Select all manual components
        POSTDEV_STATE.selectedManualComponents = POSTDEV_STATE.manualComponents.map(comp => comp.fullName);
    }
    
    localStorage.setItem('ui.postdev.selectedManual', JSON.stringify(POSTDEV_STATE.selectedManualComponents));
    renderManualComponentsList();
}

function clearManualSelection() {
    POSTDEV_STATE.selectedManualComponents = [];
    localStorage.setItem('ui.postdev.selectedManual', JSON.stringify([]));
    renderManualComponentsList();
}

function updateManualBulkActionsButton() {
    const validateButton = document.querySelector('.manual-bulk-actions .btn-primary');
    if (validateButton) {
        const selectedCount = POSTDEV_STATE.selectedManualComponents?.length || 0;
        validateButton.textContent = `🔍 Validate Selected (${selectedCount})`;
    }
}

async function validateSelectedManualComponents() {
    const selectedCount = POSTDEV_STATE.selectedManualComponents?.length || 0;
    
    if (selectedCount === 0) {
        alert('Please select at least one manual component to validate');
        return;
    }
    
    const selectedComponents = POSTDEV_STATE.manualComponents.filter(comp => 
        POSTDEV_STATE.selectedManualComponents.includes(comp.fullName)
    );
    
    if (selectedComponents.length === 0) {
        alert('No valid manual components found for validation');
        return;
    }
    
    await runPostDevAnalysis(selectedComponents);
}

function renderManualComponentsList() {
    const manualList = document.getElementById('manual-components-list');
    if (!manualList) return;

    manualList.innerHTML = '';

    if (POSTDEV_STATE.manualComponents.length === 0) {
        manualList.appendChild(createElement('div', { className: 'empty-card' }, [
            createElement('p', {}, 'No manual components added yet')
        ]));
        return;
    }

    POSTDEV_STATE.manualComponents.forEach((component, index) => {
        const isSelected = POSTDEV_STATE.selectedManualComponents?.includes(component.fullName) || false;
        
        const componentItem = createElement('div', { 
            className: `manual-component-item ${isSelected ? 'selected' : ''}` 
        }, [
            createElement('div', { className: 'manual-component-main' }, [
                createElement('div', { className: 'component-checkbox' }, [
                    createElement('input', { 
                        type: 'checkbox',
                        checked: isSelected,
                        onchange: (e) => toggleManualComponentSelection(component.fullName, e.target.checked)
                    })
                ]),
                createElement('div', { className: 'manual-component-info' }, [
                    createElement('div', { className: `component-type-badge ${component.type.toLowerCase()}` }, component.type),
                    createElement('div', { className: 'component-name' }, component.name),
                    createElement('div', { className: 'component-fullname' }, component.fullName)
                ])
            ]),
            createElement('div', { className: 'manual-component-actions' }, [
                createElement('button', { 
                    className: 'btn btn-sm btn-primary',
                    onclick: () => validateSingleComponent(component.fullName, component.type, component.name)
                }, 'Validate'),
                createElement('button', { 
                    className: 'btn btn-sm btn-danger',
                    onclick: () => removeManualComponent(index)
                }, 'Remove')
            ])
        ]);
        manualList.appendChild(componentItem);
    });

    // Update the bulk actions button text
    updateManualBulkActionsButton();
}

// API Integration Functions
async function validateProduct(productName) {
    const apiUrl = 'http://localhost:5000/api/validate-product';
    
    console.log('🔍 Calling Product Validation API:', {
        url: apiUrl,
        productName: productName
    });

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                product_name: productName
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Product Validation Result:', result);
        return result;

    } catch (error) {
        console.error('❌ Product Validation Error:', error);
        throw error;
    }
}

async function validateOmniScript(omniScriptName) {
    // TODO: Replace with actual OmniScript validation API when available
    const apiUrl = 'http://localhost:5000/api/validate-omniscrip';
    
    console.log('🔍 Calling OmniScript Validation API:', {
        url: apiUrl,
        omniScriptName: omniScriptName
    });

    try {
        // Mock implementation until OmniScript API is available
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock response - replace with actual API call
        const mockResponse = {
            success: true,
            validated: true,
            component_name: omniScriptName,
            component_type: 'OmniScript',
            details: {
                status: 'valid',
                elements_count: Math.floor(Math.random() * 20) + 5,
                validation_notes: 'OmniScript validation completed successfully'
            },
            issues: [],
            recommendations: [
                'Consider optimizing OmniScript performance',
                'Review data raptor integrations'
            ]
        };

        console.log('✅ OmniScript Validation Result:', mockResponse);
        return mockResponse;

    } catch (error) {
        console.error('❌ OmniScript Validation Error:', error);
        
        // Return mock error response
        return {
            success: false,
            validated: false,
            component_name: omniScriptName,
            component_type: 'OmniScript',
            error: error.message,
            issues: ['Validation service unavailable'],
            recommendations: ['Check OmniScript validation service status']
        };
    }
}


window.toggleComponentSelection = function(fullName, isSelected) {
    if (isSelected) {
        if (!POSTDEV_STATE.selectedComponents.includes(fullName)) {
            POSTDEV_STATE.selectedComponents.push(fullName);
        }
    } else {
        POSTDEV_STATE.selectedComponents = POSTDEV_STATE.selectedComponents.filter(name => name !== fullName);
    }
    localStorage.setItem('ui.postdev.selected', JSON.stringify(POSTDEV_STATE.selectedComponents));
    
    // Instead of re-rendering the entire tab, just update the UI elements
    updateSelectionUI();
};




window.validateSingleComponent = async function(fullName, type, name) {
    try {
        showLoadingSpinner(true, `Validating ${type}: ${name}...`);
        
        let result;
        if (type === 'Product2') {
            result = await validateProduct(name);
        } else if (type === 'OmniScript') {
            result = await validateOmniScript(name);
        } else {
            throw new Error(`Unsupported component type: ${type}`);
        }

        // Determine if validation was successful
        const isSuccess = result.status === 'SUCCESS' || result.success === true;
        const hasIssues = (result.validation && result.validation.invalid_attributes && result.validation.invalid_attributes.length > 0) || 
                         (result.issues && result.issues.length > 0);

        // Ensure the result has the proper structure for display
        const displayResult = {
            success: isSuccess,
            components: [{
                type: type,
                name: name, // Use cleaned name
                fullName: fullName,
                ...result,
                validation: result.validation || result
            }],
            summary: {
                total: 1,
                analyzed: 1,
                successful: isSuccess ? 1 : 0,
                with_issues: hasIssues ? 1 : 0,
                clean: (isSuccess && !hasIssues) ? 1 : 0,
                failed: isSuccess ? 0 : 1
            },
            meta: {
                timestamp: new Date().toISOString(),
                analysis_type: 'single'
            }
        };
        
        showAnalysisResults(displayResult, [{ fullName, type, name }]);
        
    } catch (error) {
        console.error('❌ Single component validation error:', error);
        
        const errorResult = {
            success: false,
            components: [{
                type: type,
                name: name,
                fullName: fullName,
                status: 'error',
                error: error.message,
                issues: [error.message],
                recommendations: ['Check API connectivity', 'Verify component name']
            }],
            summary: {
                total: 1,
                analyzed: 1,
                successful: 0,
                with_issues: 1,
                clean: 0,
                failed: 1
            },
            meta: {
                timestamp: new Date().toISOString(),
                analysis_type: 'single'
            }
        };
        
        showAnalysisResults(errorResult, [{ fullName, type, name }]);
        
    } finally {
        showLoadingSpinner(false);
    }
};

window.addToManualComponents = function(type, name, fullName) {
    const existing = POSTDEV_STATE.manualComponents.find(comp => 
        comp.fullName === fullName
    );
    
    if (!existing) {
        POSTDEV_STATE.manualComponents.push({ type, name, fullName });
        localStorage.setItem('ui.postdev.manual', JSON.stringify(POSTDEV_STATE.manualComponents));
        renderManualComponentsList();
        
        // Show success feedback
        if (window.toast) {
            window.toast(`Added ${name} to manual components`);
        }
    } else {
        if (window.toast) {
            window.toast(`${name} is already in manual components`);
        }
    }
};

function addManualComponent() {
    const typeSelect = document.getElementById('component-type');
    const nameInput = document.getElementById('component-name');
    
    const type = typeSelect.value;
    const name = nameInput.value.trim();
    
    if (!type || !name) {
        alert('Please select a type and enter a name');
        return;
    }
    
    const fullName = `${type}.${name}`;
    
    // Check if already exists
    const existing = POSTDEV_STATE.manualComponents.find(comp => 
        comp.fullName === fullName
    );
    
    if (existing) {
        alert('This component is already in your manual list');
        return;
    }
    
    POSTDEV_STATE.manualComponents.push({ type, name, fullName });
    localStorage.setItem('ui.postdev.manual', JSON.stringify(POSTDEV_STATE.manualComponents));
    
    // Clear inputs and refresh list
    typeSelect.value = '';
    nameInput.value = '';
    renderManualComponentsList();
    
    // Show success feedback
    if (window.toast) {
        window.toast(`Added ${name} to manual components`);
    }
}

function removeManualComponent(index) {
    POSTDEV_STATE.manualComponents.splice(index, 1);
    localStorage.setItem('ui.postdev.manual', JSON.stringify(POSTDEV_STATE.manualComponents));
    renderManualComponentsList();
}

async function runManualAnalysis() {
    if (POSTDEV_STATE.manualComponents.length === 0) {
        alert('Please add components to validate');
        return;
    }
    
    await runPostDevAnalysis(POSTDEV_STATE.manualComponents);
}


async function runPostDevAnalysis(components) {
    try {
        showLoadingSpinner(true, `Validating ${components.length} components...`);
        
        console.log('Starting PostDev validation for components:', components);
        
        const results = [];
        let successCount = 0;
        let errorCount = 0;

        // Validate each component sequentially to avoid overwhelming the API
        for (const component of components) {
            try {
                console.log(`Validating ${component.type}: ${component.name}`);
                
                let result;
                if (component.type === 'Product2') {
                    result = await validateProduct(component.name);
                } else if (component.type === 'OmniScript') {
                    result = await validateOmniScript(component.name);
                } else {
                    throw new Error(`Unsupported component type: ${component.type}`);
                }

                results.push({
                    ...component,
                    ...result
                });
                
                // Check if the validation was successful based on status
                if (result.status === 'SUCCESS' || result.success === true) {
                    successCount++;
                } else {
                    errorCount++;
                }

            } catch (error) {
                console.error(`❌ Validation failed for ${component.name}:`, error);
                results.push({
                    ...component,
                    success: false,
                    validated: false,
                    error: error.message,
                    issues: [error.message],
                    recommendations: ['Check API connectivity', 'Verify component name']
                });
                errorCount++;
            }
        }
        
        console.log('✅ PostDev Validation Complete:', {
            total: components.length,
            success: successCount,
            errors: errorCount,
            results: results
        });
        
        // Count components with issues (for summary)
        const componentsWithIssues = results.filter(r => {
            // For Product2, check if status is not SUCCESS or has invalid attributes
            if (r.type === 'Product2') {
                return r.status !== 'SUCCESS' || 
                       (r.validation && r.validation.invalid_attributes && r.validation.invalid_attributes.length > 0);
            }
            // For OmniScript, check if there are issues
            return r.issues && r.issues.length > 0;
        }).length;
        
        const cleanComponents = results.length - componentsWithIssues;
        
        // Show results
        showAnalysisResults({
            success: errorCount === 0,
            components: results,
            summary: {
                total: components.length,
                analyzed: successCount + errorCount, // Total attempted
                successful: successCount, // Actually successful validations
                with_issues: componentsWithIssues,
                clean: cleanComponents,
                failed: errorCount
            },
            meta: {
                timestamp: new Date().toISOString(),
                analysis_type: 'batch'
            }
        }, components);
        
    } catch (error) {
        console.error('❌ PostDev analysis error:', error);
        
        // Show detailed error message
        const errorModal = createElement('div', { className: 'error-modal' });
        errorModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header error">
                    <h3>❌ Validation Failed</h3>
                    <button class="close-btn" onclick="this.closest('.error-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="error-details">
                        <p><strong>Error:</strong> ${error.message}</p>
                        <p>Please check:</p>
                        <ul>
                            <li>Backend API is running at http://localhost:5000</li>
                            <li>Network connectivity</li>
                            <li>Component names are valid</li>
                        </ul>
                        <div class="debug-info">
                            <details>
                                <summary>Debug Information</summary>
                                <pre>${error.stack || 'No stack trace available'}</pre>
                            </details>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="this.closest('.error-modal').remove()">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(errorModal);
        
    } finally {
        showLoadingSpinner(false);
    }
}


function showAnalysisResults(result, components) {
    const modal = createElement('div', { className: 'analysis-results-modal' });
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${result.success ? '✅' : '❌'} PostDev Validation Results</h3>
                <button class="close-btn" onclick="this.closest('.analysis-results-modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="results-summary">
                    <h4>Validation Summary</h4>
                    <div class="summary-stats">
                        <div class="stat">
                            <span class="stat-value">${result.summary?.total || components.length}</span>
                            <span class="stat-label">Total Components</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value">${result.summary?.analyzed || components.length}</span>
                            <span class="stat-label">Attempted</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value ${result.summary?.successful > 0 ? 'success' : ''}">${result.summary?.successful || 0}</span>
                            <span class="stat-label">Successful</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value ${(result.summary?.with_issues || 0) > 0 ? 'warning' : ''}">${result.summary?.with_issues || 0}</span>
                            <span class="stat-label">With Issues</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value ${(result.summary?.failed || 0) > 0 ? 'error' : ''}">${result.summary?.failed || 0}</span>
                            <span class="stat-label">Failed</span>
                        </div>
                    </div>
                    ${result.meta?.timestamp ? `
                        <div class="analysis-meta">
                            <small>Validation completed: ${new Date(result.meta.timestamp).toLocaleString()}</small>
                        </div>
                    ` : ''}
                </div>
                <div class="results-details">
                    <h4>Component Details</h4>
                    ${renderComponentResults(result.components || components.map(comp => ({ ...comp, status: 'unknown' })))}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="this.closest('.analysis-results-modal').remove()">Close</button>
                <button class="btn btn-secondary" onclick="exportPostDevResults(${JSON.stringify(result).replace(/"/g, '&quot;')})">Export Results (JSON)</button>
                <button class="btn btn-export" onclick="exportInvalidAttributesToCSV(${JSON.stringify(result).replace(/"/g, '&quot;')})">📊 Export Invalid Attributes (CSV)</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}


function renderComponentResults(components) {
    if (!components || components.length === 0) {
        return '<div class="no-results">No validation results available</div>';
    }

    return `
        <div class="components-results">
            ${components.map(comp => {
                // Handle Product2 validation results specifically
                if (comp.type === 'Product2' && comp.validation) {
                    return renderProduct2ValidationResult(comp);
                }
                // Handle OmniScript and generic results
                return renderGenericValidationResult(comp);
            }).join('')}
        </div>
    `;
}


function renderProduct2ValidationResult(comp) {
    const validation = comp.validation;
    const statusClass = getStatusClass(comp);
    
    return `
        <div class="component-result ${statusClass}">
            <div class="component-header">
                <div class="component-name">${comp.name}</div> <!-- Use cleaned name -->
                <div class="component-status ${statusClass}">
                    ${getStatusIcon(comp)} ${getStatusText(comp)}
                </div>
            </div>
            
            <!-- Product2 Specific Validation Details -->
            <div class="product2-validation-details">
                <!-- Validation Counts -->
                ${validation && validation.details ? `
                <div class="validation-counts">
                    <strong>Attribute Analysis</strong>
                    <div class="count-grid">
                        <div class="count-item">
                            <span class="count-value">${validation.details.configured_count || 0}</span>
                            <span class="count-label">Configured</span>
                        </div>
                        <div class="count-item">
                            <span class="count-value ${validation.details.invalid_count > 0 ? 'warning' : ''}">${validation.details.invalid_count || 0}</span>
                            <span class="count-label">Invalid</span>
                        </div>
                        <div class="count-item">
                            <span class="count-value">${validation.details.present_count || 0}</span>
                            <span class="count-label">Present</span>
                        </div>
                        <div class="count-item">
                            <span class="count-value ${validation.details.missing_count > 0 ? 'warning' : ''}">${validation.details.missing_count || 0}</span>
                            <span class="count-label">Missing</span>
                        </div>
                    </div>
                </div>
                ` : ''}

                ${validation && validation.message ? `
                <div class="validation-message">
                    <strong>Message:</strong>
                    <div class="message-content">${validation.message}</div>
                </div>
                ` : ''}

                <!-- Invalid Attributes -->
                ${validation && validation.invalid_attributes && validation.invalid_attributes.length > 0 ? `
                <div class="invalid-attributes-section">
                    <strong>Invalid Attributes (${validation.invalid_attributes.length})</strong>
                    <div class="invalid-attributes-list">
                        ${validation.invalid_attributes.map(attr => `
                            <div class="invalid-attribute-item">
                                <div class="attribute-header">
                                    <span class="attribute-name">${attr.name || 'Unknown'}</span>
                                    <span class="attribute-code">${attr.code || 'N/A'}</span>
                                </div>
                                <div class="attribute-details">
                                    <div class="attribute-detail">
                                        <span class="detail-label">Current Value:</span>
                                        <span class="detail-value">${attr.current_value || 'Empty'}</span>
                                    </div>
                                    <div class="attribute-detail">
                                        <span class="detail-label">Error:</span>
                                        <span class="detail-value error">${attr.error || 'Unknown error'}</span>
                                    </div>
                                    ${attr.allowed_values && attr.allowed_values.length > 0 ? `
                                    <div class="attribute-detail">
                                        <span class="detail-label">Allowed Values:</span>
                                        <span class="detail-value">${attr.allowed_values.join(', ')}</span>
                                    </div>
                                    ` : ''}
                                    <div class="attribute-detail">
                                        <span class="detail-label">Mandatory:</span>
                                        <span class="detail-value">${attr.mandatory ? 'Yes' : 'No'}</span>
                                    </div>
                                    <div class="attribute-detail">
                                        <span class="detail-label">Type:</span>
                                        <span class="detail-value">${attr.type || 'Unknown'}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                ${comp.error ? `
                <div class="component-error">
                    <strong>Error:</strong>
                    <div class="error-message">${escapeHtml(comp.error)}</div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

function renderGenericValidationResult(comp) {
    return `
        <div class="component-result ${getStatusClass(comp)}">
            <div class="component-header">
                <div class="component-name">${comp.fullName || comp.name}</div>
                <div class="component-status ${getStatusClass(comp)}">
                    ${getStatusIcon(comp)} ${getStatusText(comp)}
                </div>
            </div>
            ${comp.details ? `
                <div class="component-details">
                    <strong>Details:</strong>
                    <pre>${JSON.stringify(comp.details, null, 2)}</pre>
                </div>
            ` : ''}
            ${comp.issues && comp.issues.length > 0 ? `
                <div class="component-issues">
                    <strong>Issues (${comp.issues.length}):</strong>
                    <ul>
                        ${comp.issues.map(issue => `<li>${escapeHtml(issue)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            ${comp.recommendations && comp.recommendations.length > 0 ? `
                <div class="component-recommendations">
                    <strong>Recommendations:</strong>
                    <ul>
                        ${comp.recommendations.map(rec => `<li>${escapeHtml(rec)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            ${comp.error ? `
                <div class="component-error">
                    <strong>Error:</strong>
                    <div class="error-message">${escapeHtml(comp.error)}</div>
                </div>
            ` : ''}
        </div>
    `;
}

function getStatusText(component) {
    if (component.error || component.success === false) return 'Validation Failed';
    
    // Handle Product2 validation status
    if (component.type === 'Product2') {
        const status = component.status || (component.validation && component.validation.status);
        if (status === 'ERROR') return 'Error';
        if (status === 'PARTIAL') return 'Partial';
        if (status === 'SUCCESS') {
            if (component.validation && component.validation.invalid_attributes && component.validation.invalid_attributes.length > 0) {
                return 'Has Issues';
            }
            return 'Valid';
        }
    }
    
    if (component.validated === false) return 'Invalid';
    if (component.issues && component.issues.length > 0) return 'Has Issues';
    if (component.validated === true || component.success === true) return 'Valid';
    return 'Unknown';
}

function showLoadingSpinner(show, message = 'Loading...') {
    console.log('🔄 Loading Spinner:', show, message); // Debug log
    
    let spinner = document.getElementById('postdev-loading-spinner');
    
    if (show) {
        if (spinner) {
            spinner.remove();
        }
        
        spinner = document.createElement('div');
        spinner.id = 'postdev-loading-spinner';
        spinner.innerHTML = `
            <div class="loading-overlay">
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <div class="loading-message">${message}</div>
                </div>
            </div>
        `;
        document.body.appendChild(spinner);
        console.log('✅ Spinner added to DOM'); // Debug log
    } else {
        if (spinner) {
            spinner.remove();
            console.log('✅ Spinner removed from DOM'); // Debug log
        }
    }
}


function getStatusClass(component) {
    // Handle API errors first
    if (component.error || component.success === false) return 'error';
    
    // Handle Product2 validation status
    if (component.type === 'Product2') {
        const status = component.status || (component.validation && component.validation.status);
        if (status === 'ERROR') return 'error';
        if (status === 'PARTIAL') return 'warning';
        if (status === 'SUCCESS') {
            // Even if status is SUCCESS, check for invalid attributes
            if (component.validation && component.validation.invalid_attributes && component.validation.invalid_attributes.length > 0) {
                return 'warning';
            }
            return 'clean';
        }
    }
    
    // Generic status detection
    if (component.validated === false) return 'warning';
    if (component.issues && component.issues.length > 0) return 'warning';
    if (component.validated === true || component.success === true) return 'clean';
    return 'unknown';
}




function getStatusIcon(component) {
    if (component.error || component.success === false) return '❌';
    
    // Handle Product2 validation status
    if (component.type === 'Product2' && component.validation) {
        const status = component.validation.status;
        if (status === 'PARTIAL') return '⚠️';
        if (status === 'INVALID') return '❌';
        if (status === 'VALID') return '✅';
    }
    
    if (component.validated === false) return '⚠️';
    if (component.issues && component.issues.length > 0) return '⚠️';
    if (component.validated === true || component.success === true) return '✅';
    return '❓';
}


// Add this function for quick export
window.exportSelectedComponents = function(components) {
    const exportData = components.map(comp => ({
        'Component Type': comp.type,
        'Component Name': comp.name,
        'Full Name': comp.fullName,
        'Found in Stories': comp.storyIds ? comp.storyIds.join('; ') : 'N/A',
        'Occurrence Count': comp.count || 1
    }));
    
    const csvContent = convertToCSV(exportData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `selected-components-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (window.toast) {
        window.toast(`Exported ${components.length} components to CSV`);
    }
};

window.exportInvalidAttributesToCSV = function(result) {
    // Collect all products with invalid attributes
    const productsWithInvalidAttributes = [];
    
    if (result.components && Array.isArray(result.components)) {
        result.components.forEach(component => {
            // Only process Product2 components with invalid attributes
            if (component.type === 'Product2' && 
                component.validation && 
                component.validation.invalid_attributes && 
                component.validation.invalid_attributes.length > 0) {
                
                const productName = component.name || 'Unknown Product';
                const productStatus = component.validation.status || 'Unknown';
                
                component.validation.invalid_attributes.forEach(attr => {
                    productsWithInvalidAttributes.push({
                        'Product Name': productName,
                        'Product Status': productStatus,
                        'Attribute Name': attr.name || 'Unknown',
                        'Attribute Code': attr.code || 'N/A',
                        'Current Value': attr.current_value || 'Empty',
                        'Error Message': attr.error || 'Unknown error',
                        'Allowed Values': attr.allowed_values ? attr.allowed_values.join('; ') : 'N/A',
                        'Mandatory': attr.mandatory ? 'Yes' : 'No',
                        'Attribute Type': attr.type || 'Unknown',
                        'Validation Timestamp': result.meta?.timestamp || new Date().toISOString()
                    });
                });
            }
        });
    }
    
    if (productsWithInvalidAttributes.length === 0) {
        alert('No invalid attributes found to export.');
        return;
    }
    
    // Convert to CSV
    const csvContent = convertToCSV(productsWithInvalidAttributes);
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `invalid-attributes-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Helper function to convert array of objects to CSV
function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [];
    
    // Add header row
    csvRows.push(headers.join(','));
    
    // Add data rows
    data.forEach(row => {
        const values = headers.map(header => {
            let value = row[header] || '';
            
            // Escape quotes and wrap in quotes if contains comma, quote, or newline
            if (typeof value === 'string') {
                value = value.replace(/"/g, '""');
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = `"${value}"`;
                }
            }
            
            return value;
        });
        
        csvRows.push(values.join(','));
    });
    
    return csvRows.join('\n');
}

window.exportPostDevResults = function(result) {
    const data = {
        analysis_type: 'postdev_validation',
        timestamp: result.meta?.timestamp || new Date().toISOString(),
        summary: result.summary,
        components: result.components,
        metadata: result.meta
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `postdev-validation-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
};

// Helper functions
function createElement(tag, props = {}, children = []) {
    const node = Object.assign(document.createElement(tag), props);
    const childArray = Array.isArray(children) ? children : children ? [children] : [];
    childArray.forEach(child => {
        if (typeof child === 'string') {
            node.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            node.appendChild(child);
        }
    });
    return node;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


// CSS Styles (same as previous version, included for completeness)
const injectPostDevStyles = (() => {
    let done = false;
    return () => {
        if (done) return;
        done = true;

        const css = `

            .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    }
        .btn-export {
    background: #34c759 !important;
    color: white !important;
    border-color: #34c759 !important;
}

.btn-export:hover {
    background: #2ca84d !important;
    border-color: #2ca84d !important;
}

.modal-footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding: 24px;
    border-top: 1px solid #e5e5e7;
    flex-wrap: wrap;
}

@media (max-width: 768px) {
    .modal-footer {
        flex-direction: column;
    }
    
    .modal-footer .btn {
        width: 100%;
        text-align: center;
    }
}


    .loading-spinner {
        background: white;
        padding: 30px;
        border-radius: 12px;
        text-align: center;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        min-width: 200px;
    }

    .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #0071e3;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
    }
        .stat:nth-child(5) .stat-value {
    color: #ff3b30; /* Red for Failed */
}

.stat-value.error {
    color: #ff3b30 !important;
}

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .loading-message {
        font-size: 16px;
        color: #1d1d1f;
        font-weight: 500;
    }

            .postdev-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 24px;
                margin-top: 20px;
            }

            @media (max-width: 968px) {
                .postdev-grid {
                    grid-template-columns: 1fr;
                }
            }

            .extraction-panel,
            .manual-panel {
                background: white;
                border: 1px solid #e5e5e7;
                border-radius: 12px;
                padding: 24px;
            }

            .panel-header h3 {
                margin: 0 0 8px 0;
                font-size: 18px;
                font-weight: 600;
                color: #1d1d1f;
            }

            .panel-subtitle {
                margin: 0;
                font-size: 13px;
                color: #86868b;
            }

            .extraction-stats {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                margin: 16px 0;
                padding: 16px;
                background: #f8f9fa;
                border-radius: 8px;
            }

            .stat-item {
                text-align: center;
            }

            /* Manual Components Selection Styles */
.manual-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e5e5e7;
}

.manual-list-header h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #1d1d1f;
}

.manual-bulk-actions {
    display: flex;
    gap: 8px;
}

.manual-components-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
}

.manual-component-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border: 1px solid #e5e5e7;
    border-radius: 8px;
    background: white;
    transition: all 0.2s ease;
}

.manual-component-item:hover {
    border-color: #0071e3;
    box-shadow: 0 2px 8px rgba(0, 113, 227, 0.1);
}

.manual-component-item.selected {
    border-color: #0071e3;
    background: #f0f7ff;
}

.manual-component-main {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
}

.manual-component-info {
    flex: 1;
}

.manual-component-actions {
    display: flex;
    gap: 8px;
}

.component-checkbox input {
    margin: 0;
    width: 16px;
    height: 16px;
}

/* Compact manual component info */
.manual-component-info .component-type-badge {
    margin-bottom: 4px;
}

.manual-component-info .component-name {
    font-size: 14px;
    font-weight: 600;
    color: #1d1d1f;
    margin-bottom: 2px;
}

.manual-component-info .component-fullname {
    font-size: 12px;
    color: #86868b;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
}

/* Responsive manual components */
@media (max-width: 768px) {
    .manual-list-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
    }
    
    .manual-bulk-actions {
        width: 100%;
        justify-content: space-between;
    }
    
    .manual-component-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
    }
    
    .manual-component-main {
        width: 100%;
    }
    
    .manual-component-actions {
        width: 100%;
        justify-content: flex-end;
    }
}

            .stat-item .stat-value {
                display: block;
                font-size: 20px;
                font-weight: 700;
                color: #0071e3;
            }

            .stat-item .stat-label {
                display: block;
                font-size: 12px;
                color: #86868b;
                margin-top: 4px;
            }

            .components-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin: 16px 0;
                max-height: 400px;
                overflow-y: auto;
            }

  
            // Replace the existing Product2 Validation CSS with this:
/* Enhanced Product2 Validation Styles */
.product2-validation-details {
    margin-top: 20px;
}





product2-validation-details {
    margin-top: 20px;
}

/* Improved Validation Counts */
.validation-counts {
    margin: 0 0 20px 0;
    padding: 20px;
    border: 1px solid #e5e5e7;
    border-radius: 8px;
    background: #f8f9fa;
}

.validation-counts strong {
    display: block;
    margin-bottom: 16px;
    color: #1d1d1f;
    font-size: 16px;
    font-weight: 600;
}

.count-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-top: 8px;
}

.count-item {
    text-align: center;
    padding: 20px 12px;
    background: white;
    border-radius: 8px;
    border: 1px solid #e5e5e7;
    transition: all 0.2s ease;
}

.count-item:hover {
    border-color: #0071e3;
    box-shadow: 0 2px 8px rgba(0, 113, 227, 0.1);
}

.count-value {
    display: block;
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 8px;
    color: #0071e3;
}

.count-value.warning {
    color: #ff9500;
}

.count-label {
    display: block;
    font-size: 13px;
    color: #86868b;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* Improved Validation Counts */
.validation-counts {
    margin: 20px 0;
    padding: 20px;
    border: 1px solid #e5e5e7;
    border-radius: 8px;
    background: #f8f9fa;
}

.validation-counts strong {
    display: block;
    margin-bottom: 16px;
    color: #1d1d1f;
    font-size: 16px;
    font-weight: 600;
}

.count-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-top: 8px;
}

.count-item {
    text-align: center;
    padding: 20px 12px;
    background: white;
    border-radius: 8px;
    border: 1px solid #e5e5e7;
    transition: all 0.2s ease;
}

.count-item:hover {
    border-color: #0071e3;
    box-shadow: 0 2px 8px rgba(0, 113, 227, 0.1);
}

.count-value {
    display: block;
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 8px;
    color: #0071e3;
}

.count-value.warning {
    color: #ff9500;
}

.count-label {
    display: block;
    font-size: 13px;
    color: #86868b;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* Improved Invalid Attributes */
.invalid-attributes-section {
    margin: 20px 0;
    padding: 20px;
    border: 1px solid #e5e5e7;
    border-radius: 8px;
    background: #f8f9fa;
}

.invalid-attributes-section strong {
    display: block;
    margin-bottom: 16px;
    color: #1d1d1f;
    font-size: 16px;
    font-weight: 600;
}

.invalid-attributes-list {
    margin-top: 16px;
    max-height: 400px;
    overflow-y: auto;
}

.invalid-attribute-item {
    background: white;
    border: 1px solid #ffcdd2;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 16px;
    transition: all 0.2s ease;
}

.invalid-attribute-item:hover {
    border-color: #ff3b30;
    box-shadow: 0 2px 8px rgba(255, 59, 48, 0.1);
}

.attribute-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid #ffebee;
}

.attribute-name {
    font-weight: 600;
    color: #d32f2f;
    font-size: 16px;
}

.attribute-code {
    font-size: 12px;
    color: #86868b;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    background: #f5f5f5;
    padding: 6px 10px;
    border-radius: 6px;
    max-width: 250px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.attribute-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
}

.attribute-detail {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.detail-label {
    font-size: 12px;
    font-weight: 600;
    color: #86868b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.detail-value {
    font-size: 14px;
    color: #1d1d1f;
    font-weight: 500;
    word-break: break-word;
}

.detail-value.error {
    color: #ff3b30;
    font-weight: 600;
    background: #ffebee;
    padding: 8px 12px;
    border-radius: 6px;
    border-left: 4px solid #ff3b30;
}

/* Present Attributes */
.present-attributes-summary {
    margin: 20px 0;
    padding: 20px;
    border: 1px solid #e5e5e7;
    border-radius: 8px;
    background: #f8f9fa;
}

.present-attributes-summary details {
    cursor: pointer;
}

.present-attributes-summary summary {
    font-weight: 600;
    color: #1d1d1f;
    font-size: 16px;
    list-style: none;
}

.present-attributes-summary summary::-webkit-details-marker {
    display: none;
}

.present-attributes-summary summary::before {
    content: '▶';
    display: inline-block;
    margin-right: 8px;
    transition: transform 0.2s ease;
}

.present-attributes-summary details[open] summary::before {
    transform: rotate(90deg);
}

.present-attributes-list {
    margin-top: 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.present-attribute {
    background: #e8f5e8;
    color: #2e7d32;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    border: 1px solid #c8e6c9;
    font-weight: 500;
}

.more-attributes {
    color: #86868b;
    font-size: 12px;
    font-style: italic;
    align-self: center;
}

/* Improved Modal Body Layout */
.modal-body {
    flex: 1;
    padding: 24px;
    overflow-y: auto;
    max-height: 70vh;
}

.results-summary {
    margin-bottom: 24px;
    padding: 24px;
    border: 1px solid #e5e5e7;
    border-radius: 8px;
    background: #f8f9fa;
}

.results-summary h4 {
    margin: 0 0 20px 0;
    font-size: 18px;
    font-weight: 600;
    color: #1d1d1f;
}


/* More Vibrant Summary Stats Colors */
.summary-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 20px;
    margin: 20px 0;
}

.stat {
    text-align: center;
    padding: 20px 16px;
    border-radius: 8px;
    background: white;
    border: 1px solid #e5e5e7;
    transition: all 0.2s ease;
}

.stat:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stat-value {
    display: block;
    font-size: 32px;
    font-weight: 800;
    margin-bottom: 8px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Very distinct colors for each stat */
.stat:nth-child(1) .stat-value {
    color: #0071e3; /* Bright Blue for Total Components */
    background: linear-gradient(135deg, #0071e3, #0056b3);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.stat:nth-child(2) .stat-value {
    color: #bf5af2; /* Bright Purple for Validated */
    background: linear-gradient(135deg, #bf5af2, #8944ab);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.stat:nth-child(3) .stat-value {
    color: #ff453a; /* Bright Red for With Issues */
    background: linear-gradient(135deg, #ff453a, #d70015);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.stat:nth-child(4) .stat-value {
    color: #30d158; /* Bright Green for Clean */
    background: linear-gradient(135deg, #30d158, #1e8e3e);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

/* Keep conditional styling */
.stat-value.warning {
    color: #ff453a !important;
    background: none !important;
    -webkit-text-fill-color: #ff453a !important;
}

.stat-value.success {
    color: #30d158 !important;
    background: none !important;
    -webkit-text-fill-color: #30d158 !important;
}

.stat-label {
    font-size: 13px;
    color: #1d1d1f;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 4px;
}





.stat-label {
    font-size: 13px;
    color: #86868b;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.analysis-meta {
    text-align: center;
    margin-top: 16px;
    color: #86868b;
    font-size: 13px;
}

.results-details {
    margin-top: 24px;
}

.results-details h4 {
    margin: 0 0 20px 0;
    font-size: 18px;
    font-weight: 600;
    color: #1d1d1f;
}

/* Responsive Improvements */
@media (max-width: 768px) {
    .count-grid {
        grid-template-columns: repeat(2, 1fr);
    }
    
    .validation-stats {
        grid-template-columns: 1fr;
    }
    
    .attribute-details {
        grid-template-columns: 1fr;
    }
    
    .attribute-header {
        flex-direction: column;
        gap: 12px;
        align-items: flex-start;
    }
    
    .attribute-code {
        max-width: 100%;
        align-self: stretch;
    }
    
    .summary-stats {
        grid-template-columns: repeat(2, 1fr);
    }
    
    .validation-stat {
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
    }
    
    .stat {
        padding: 16px 12px;
    }
    
    .stat-value {
        font-size: 24px;
    }
}





/* Responsive adjustments */
@media (max-width: 768px) {
    .count-grid {
        grid-template-columns: repeat(2, 1fr);
    }
    
    .validation-stats {
        grid-template-columns: 1fr;
    }
    
    .attribute-details {
        grid-template-columns: 1fr;
    }
}

            .component-card {
                border: 1px solid #e5e5e7;
                border-radius: 8px;
                padding: 16px;
                transition: all 0.2s ease;
                background: white;
            }

            .component-card:hover {
                border-color: #0071e3;
                box-shadow: 0 2px 8px rgba(0, 113, 227, 0.1);
            }

            .component-card.selected {
                border-color: #0071e3;
                background: #f0f7ff;
            }

            .component-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 8px;
            }

            .component-checkbox input {
                margin: 0;
            }

            .component-type-badge {
                padding: 4px 8px;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
            }

            .component-type-badge.omniscript {
                background: #e8f0ff;
                color: #0071e3;
            }

            .component-type-badge.product2 {
                background: #f0fff4;
                color: #34c759;
            }

            .component-count {
                font-size: 11px;
                color: #86868b;
                margin-left: auto;
            }

            .component-name {
                font-size: 14px;
                font-weight: 600;
                color: #1d1d1f;
                margin-bottom: 4px;
            }

            .component-fullname {
                font-size: 12px;
                color: #86868b;
                font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
                margin-bottom: 8px;
            }

            .component-stories {
                margin-bottom: 12px;
            }

            .story-id {
                background: #f5f5f7;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 11px;
                font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
            }

            .component-actions {
                display: flex;
                gap: 8px;
            }

            .bulk-actions {
                display: flex;
                gap: 12px;
                margin-top: 16px;
                padding-top: 16px;
                border-top: 1px solid #e5e5e7;
            }

            .manual-form {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .form-group {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .form-group label {
                font-size: 13px;
                font-weight: 600;
                color: #1d1d1f;
            }

            .form-select,
            .form-input {
                padding: 10px 12px;
                border: 1px solid #e5e5e7;
                border-radius: 8px;
                font-size: 13px;
            }

            .form-select:focus,
            .form-input:focus {
                outline: none;
                border-color: #0071e3;
                box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.1);
            }

            .form-actions {
                display: flex;
                gap: 12px;
            }

            .manual-list {
                margin-top: 24px;
            }

            .manual-list h4 {
                margin: 0 0 12px 0;
                font-size: 15px;
                font-weight: 600;
            }

            .manual-component-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px;
                border: 1px solid #e5e5e7;
                border-radius: 8px;
                margin-bottom: 8px;
            }

            .manual-component-info {
                flex: 1;
            }

            /* Enhanced Results Styles */
            .analysis-results-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            }

            .modal-content {
                background: white;
                border-radius: 12px;
                padding: 0;
                max-width: 800px;
                width: 90%;
                max-height: 80vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }

            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 24px;
                border-bottom: 1px solid #e5e5e7;
            }

            .modal-header.error {
                background: #ff3b30;
                color: white;
            }

            .modal-header h3 {
                margin: 0;
                font-size: 20px;
                font-weight: 600;
            }

            .close-btn {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #86868b;
            }

            .modal-header.error .close-btn {
                color: white;
            }

            .modal-body {
                flex: 1;
                padding: 24px;
                overflow-y: auto;
            }

            .summary-stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 16px;
                margin: 16px 0;
            }

            .stat {
                text-align: center;
                padding: 16px;
                border-radius: 8px;
                background: #f8f9fa;
                border: 1px solid #e5e5e7;
            }

            .stat-value {
                display: block;
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 4px;
            }

            .stat-value.success {
                color: #34c759;
            }

            .stat-value.warning {
                color: #ff9500;
            }

            .stat-label {
                font-size: 12px;
                color: #86868b;
                font-weight: 500;
            }

            .analysis-meta {
                text-align: center;
                margin-top: 12px;
                color: #86868b;
            }

            .components-results {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-top: 16px;
            }

            .component-result {
                border: 1px solid #e5e5e7;
                border-radius: 8px;
                padding: 16px;
                background: white;
            }

            .component-result.clean {
                border-left: 4px solid #34c759;
            }

            .component-result.warning {
                border-left: 4px solid #ff9500;
            }

            .component-result.error {
                border-left: 4px solid #ff3b30;
            }

            .component-result.unknown {
                border-left: 4px solid #8e8e93;
            }

            .component-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }

            .component-name {
                font-weight: 600;
                color: #1d1d1f;
                font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
            }

            .component-status {
                padding: 4px 8px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
            }

            .component-status.clean {
                background: #e8f5e9;
                color: #1b5e20;
            }

            .component-status.warning {
                background: #fff3e0;
                color: #e65100;
            }

            .component-status.error {
                background: #ffebee;
                color: #b71c1c;
            }

            .component-status.unknown {
                background: #f5f5f5;
                color: #666;
            }

            .component-details,
            .component-issues,
            .component-recommendations,
            .component-error {
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid #f0f0f0;
            }

            .component-details pre,
            .component-diff pre {
                background: #f8f9fa;
                padding: 12px;
                border-radius: 6px;
                font-size: 12px;
                overflow-x: auto;
                margin: 8px 0 0 0;
            }

            .component-issues ul,
            .component-recommendations ul {
                margin: 8px 0 0 0;
                padding-left: 20px;
            }

            .component-issues li {
                color: #ff3b30;
            }

            .component-recommendations li {
                color: #0071e3;
            }

            .component-error .error-message {
                background: #ffebee;
                padding: 8px 12px;
                border-radius: 6px;
                margin-top: 8px;
                font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
                font-size: 12px;
            }

            .modal-footer {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
                padding: 24px;
                border-top: 1px solid #e5e5e7;
            }

            .empty-state {
                text-align: center;
                padding: 40px 20px;
                color: #86868b;
            }

            .empty-card {
                text-align: center;
                padding: 40px 20px;
                color: #86868b;
                border: 1px dashed #e5e5e7;
                border-radius: 8px;
            }

            .btn {
                padding: 8px 16px;
                border: 1px solid #e5e5e7;
                border-radius: 6px;
                background: white;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.2s ease;
            }

            .btn:hover {
                background: #f5f5f7;
            }

            .btn-primary {
                background: #0071e3;
                color: white;
                border-color: #0071e3;
            }

            .btn-primary:hover {
                background: #0056b3;
                border-color: #0056b3;
            }

            .btn-secondary {
                background: #f5f5f7;
                color: #1d1d1f;
            }

            .btn-secondary:hover {
                background: #e5e5e7;
            }

            .btn-sm {
                padding: 6px 12px;
                font-size: 12px;
            }

            .btn-danger {
                background: #ff3b30;
                color: white;
                border-color: #ff3b30;
            }

            .btn-danger:hover {
                background: #e63329;
                border-color: #e63329;
            }

            .error-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            }

            .error-details {
                background: #ffebee;
                border: 1px solid #ffcdd2;
                border-radius: 8px;
                padding: 16px;
                margin: 16px 0;
            }

            .error-details ul {
                margin: 8px 0 0 20px;
            }

            .debug-info {
                margin-top: 12px;
            }

            .debug-info details {
                margin-top: 8px;
            }

            .debug-info summary {
                cursor: pointer;
                font-weight: 600;
            }

            .debug-info pre {
                background: #f5f5f5;
                padding: 8px;
                border-radius: 4px;
                font-size: 11px;
                overflow-x: auto;
                margin-top: 8px;
            }

            .no-results {
                text-align: center;
                padding: 40px 20px;
                color: #86868b;
                font-style: italic;
            }

            /* Responsive Design */
            @media (max-width: 768px) {
                .summary-stats {
                    grid-template-columns: repeat(2, 1fr);
                }

                .extraction-stats {
                    grid-template-columns: 1fr;
                }

                .component-header {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 8px;
                }

                .component-status {
                    align-self: flex-start;
                }

                .component-actions {
                    flex-direction: column;
                }

                .bulk-actions {
                    flex-direction: column;
                }

                .form-actions {
                    flex-direction: column;
                }

                .modal-footer {
                    flex-direction: column;
                }
            }
        `;

        document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
    };
})();