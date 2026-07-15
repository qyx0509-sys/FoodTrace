Component({
  options: {
    styleIsolation: 'apply-shared',
  },
  properties: {
    description: { type: String, value: '' },
    icon: { type: String, value: 'search' },
    title: { type: String, value: '' },
    tone: { type: String, value: 'orange' },
  },
  methods: {
    onTap(): void {
      this.triggerEvent('action');
    },
  },
});
