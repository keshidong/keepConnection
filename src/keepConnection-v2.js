// error类型 todo:ts? 需要统一timeoutP定义的error和retry, next函数定义的error
const timeoutP = (timeMS, message = 'timeout' ) => (
    new Promise((resolve) => {
        setTimeout(() => { resolve([{ message }]) }, timeMS)
    })
)

export const makeRetryUnlimited = (
    request,
    stop = () => (false), // stop同步调用
) => {
    const retryUnlimited = async (lastRequestRes) => {
        const errMsg = stop(lastRequestRes)
        if (errMsg) {
            // break retry
            return [errMsg, null]
        }

        // hook
        const [requestErr, res] = await request(lastRequestRes)
        if (!requestErr) {
            return [null, res]
        }

        return retryUnlimited(lastRequestRes)
    }
    return retryUnlimited
}

// 正常轮询
export const makeNextUnlimited = (
    request,
    stop = () => (false),
    error = () => {},
) => async function nextUnlimited(lastRequestRes = null) {
    const errMsg = stop(lastRequestRes)
    if (errMsg) {
        return
    }

    const [err, curRequestRes] = await request(lastRequestRes)
    if (err) {
        error(err, lastRequestRes)
        return
    }

    nextUnlimited(curRequestRes)
}

const defaultMinIntervalTimeMS = 10000
const defaultMaxIntervalTimeMS = 30000

const defaultRetryMinIntervalTimeMS = 10000
const defaultRetryMaxIntervalTimeMS = 30000

const keepConnection = async (request, initRes, stop, {
    nextMinIntervalTimeMS = () => (defaultMinIntervalTimeMS),
    nextMaxIntervalTimeMS = () => (defaultMaxIntervalTimeMS),
    retryMinIntervalTimeMS = () => (defaultRetryMinIntervalTimeMS),
    retryMaxIntervalTimeMS = () => (defaultRetryMaxIntervalTimeMS),
}) => {
    const retryUnlimited = (() => {
        let retryMinIntervalTimeMSP
        makeRetryUnlimited(async (lastRequestRes) => {
            // todo
            stop(lastRequestRes)

            retryMinIntervalTimeMSP = timeoutP(retryMinIntervalTimeMS(lastRequestRes))

            const retryMaxIntervalTimeMSP = timeoutP(retryMaxIntervalTimeMS(defaultRetryMaxIntervalTimeMS))
            const [err, requestRes] = await Promise.race([retryMaxIntervalTimeMSP, request(lastRequestRes)])
            await Promise.resolve(retryMinIntervalTimeMSP)

            return [err, requestRes]
        }, (res) => {
            return stop('retry', res)
        })
    })()

    const nextUnlimited = (() => {
        let nextMinIntervalTimeMS
        makeNextUnlimited(async (lastRequestRes) => {
            nextMinIntervalTimeMS = timeoutP(nextMinIntervalTimeMS(lastRequestRes))

            const nextMaxIntervalTimeMSP = timeoutP(nextMaxIntervalTimeMS(lastRequestRes))
            const [err, requestRes] = Promise.race([nextMaxIntervalTimeMSP, request(lastRequestRes)])
            await Promise.resolve(nextMinIntervalTimeMS)
            return [err, requestRes]
        }, (res) => {
            return stop('next', res)
        }, async (err, lastRequestRes) => {
            // handle error
            const [retryErr, requestRes] = await retryUnlimited(lastRequestRes)
            if (!retryErr) {
                nextUnlimited(requestRes)
            }
        })
    })()
    nextUnlimited(initRes)
}

export default keepConnection
