export const parseEmailsFromFile = async (file: File): Promise<{ valid: number; invalid: number; duplicates: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        // Basic parsing: split by newlines, commas, or semicolons
        const rawItems = text.split(/[\n,;]+/).map(item => item.trim()).filter(Boolean);
        
        let valid = 0;
        let invalid = 0;
        let duplicates = 0;
        const uniqueEmails = new Set<string>();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        rawItems.forEach(item => {
          if (emailRegex.test(item)) {
            if (uniqueEmails.has(item)) {
              duplicates++;
            } else {
              uniqueEmails.add(item);
              valid++;
            }
          } else {
            invalid++;
          }
        });

        resolve({ valid, invalid, duplicates });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};
