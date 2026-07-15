Component({
  options: {
    styleIsolation: 'apply-shared',
  },
  properties: {
    record: { type: Object, value: null },
  },
  methods: {
    onTap(): void {
      const record = (this.data as unknown as { record?: { id?: unknown } }).record;
      if (typeof record?.id === 'string') {
        this.triggerEvent('select', { id: record.id });
      }
    },
  },
});
