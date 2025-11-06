const customConfigKeys = ['inherit'];

export function useGetPropsByAttrs(attrs: Record<string, any>) {
    const config: Record<string, any> = {};
    const eleConf: Record<string, any> = {};
    Object.keys(attrs).forEach((key) => {
        if (!key.startsWith('on'))
          customConfigKeys.includes(key) ?
            (eleConf[key] = attrs[key])
            : (config[key] = attrs[key]);
    });
    return {
      eleConf,
      meta2dConf:config,
    };
}
