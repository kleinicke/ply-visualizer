<script lang="ts">
  import { onMount } from 'svelte';
  
  let fileList: string[] = [];
  let fileStats = '';
  
  onMount(() => {
    // Listen for file loading events
    window.addEventListener('fileLoaded', (event: any) => {
      const fileName = event.detail?.fileName;
      if (fileName && !fileList.includes(fileName)) {
        fileList = [...fileList, fileName];
        updateStats();
      }
    });
    
    // For testing - simulate file loading
    if (typeof window !== 'undefined') {
      (window as any).loadTestFile = (fileName: string) => {
        if (!fileList.includes(fileName)) {
          fileList = [...fileList, fileName];
          updateStats();
        }
      };
    }
  });
  
  function updateStats() {
    if (fileList.length > 0) {
      fileStats = `${fileList.length} file(s) loaded`;
    } else {
      fileStats = 'No files loaded';
    }
  }
  
  function handleFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const fileName = files[i].name;
        if (!fileList.includes(fileName)) {
          fileList = [...fileList, fileName];
          
          // Dispatch file loaded event
          window.dispatchEvent(new CustomEvent('fileLoaded', { 
            detail: { fileName, file: files[i] } 
          }));
        }
      }
      updateStats();
    }
  }
</script>

<div class="file-manager">
  <div class="file-input-container">
    <input 
      type="file" 
      id="file-input"
      multiple 
      accept=".ply,.obj,.stl,.xyz,.npy,.npz,.tif,.tiff,.png,.pfm,.json"
      on:change={handleFileInput}
    />
    <label for="file-input">Choose Files</label>
  </div>
  
  <div id="file-list" class="file-list">
    {#each fileList as fileName}
      <div class="file-item">{fileName}</div>
    {/each}
  </div>
  
  <div id="file-stats" class="file-stats">
    {fileStats}
  </div>
</div>

<style>
  .file-manager {
    padding: 10px;
    border: 1px solid #ccc;
    margin: 5px;
    background: #f9f9f9;
    border-radius: 4px;
  }
  
  .file-input-container {
    margin-bottom: 10px;
  }
  
  #file-input {
    display: none;
  }
  
  label[for="file-input"] {
    display: inline-block;
    padding: 8px 16px;
    background: #007acc;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }
  
  label[for="file-input"]:hover {
    background: #005a9e;
  }
  
  .file-list {
    max-height: 200px;
    overflow-y: auto;
    margin: 10px 0;
    border: 1px solid #ddd;
    border-radius: 2px;
    min-height: 40px;
  }
  
  .file-item {
    padding: 5px 10px;
    border-bottom: 1px solid #eee;
    background: white;
  }
  
  .file-item:last-child {
    border-bottom: none;
  }
  
  .file-stats {
    font-size: 12px;
    color: #666;
    padding: 5px 0;
  }
</style>