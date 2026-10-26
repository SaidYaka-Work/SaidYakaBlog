export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const bare = specifier.split('?')[0];
    if (specifier.startsWith('.') && !/\.[a-zA-Z0-9]+$/.test(bare)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    throw error;
  }
}
