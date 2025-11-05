export function useGetPropsByAttrs(attrs: Record<string, any>) {
    const config: Record<string, any> = {}
    Object.keys(attrs).forEach((key) => {
        if (!key.startsWith('on'))
            config[key] = attrs[key]
    })
    return config
}
