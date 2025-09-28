# Page snapshot

```yaml
- generic [ref=e2]:
    - banner [ref=e3]:
        - generic [ref=e4]:
            - heading "Kunstsammlung" [level=1] [ref=e5]
            - button "+ Kunstwerk hinzufügen" [ref=e7]:
                - generic [ref=e8]: +
                - text: Kunstwerk hinzufügen
    - navigation [ref=e9]:
        - button "Galerie" [ref=e10] [cursor=pointer]
    - generic [ref=e12]:
        - generic [ref=e13]:
            - generic [ref=e14]: 'Typ:'
            - combobox [ref=e15]:
                - option "Alle Werke" [selected]
                - option "Einzelstücke"
                - option "Editionen"
        - generic [ref=e16]:
            - generic [ref=e17]: 'Standort:'
            - listbox [ref=e18]
        - generic [ref=e19]:
            - generic [ref=e20]: 'Status:'
            - combobox [ref=e21]:
                - option "Alle" [selected]
                - option "Verfügbar"
                - option "Verkauft"
        - generic [ref=e22]:
            - generic [ref=e23]: 'Tags:'
            - listbox [ref=e24]
        - generic [ref=e25]:
            - generic [ref=e26]: 'Entstehungsjahr:'
            - generic [ref=e27]:
                - spinbutton [ref=e28]
                - spinbutton [ref=e29]
        - button "Filter zurücksetzen" [ref=e30]
    - main [ref=e31]
```
