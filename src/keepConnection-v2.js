// error类型 todo:ts? 需要统一timeoutP定义的error和retry, next函数定义的error
const timeoutP = (timeMS) => (
    new Promise((resolve) => {
        if (timeMS <= 0) {
            // todo:
            resolve(null)
        } else if (timeMS === Infinity) {
            // no resolve
        } else {
            setTimeout(() => { resolve(null) }, timeMS)
        }
    })
)

const redefinedRequest = (
    request,
    minInterval = () => (0),
    maxInterval = () => (Infinity),
) => async (lastRequestRes, exportCall) => {
    const requestP = request(lastRequestRes)
    // 处理请求结束
    requestP.then((res) => {
        exportCall(res)
    })

    // 计算下次轮询时机并等待
    await Promise.race([
        Promise.all([requestP, timeoutP(minInterval(lastRequestRes))]),
        timeoutP(maxInterval(lastRequestRes))
    ])
}

export const makeRetryUnlimited = (
    rRequest,
    stop = () => (false),
    minRetryInterval,
    maxRetryInterval,
) => (lastRequestRes) => {
    let isResolved = false

    return new Promise((resolve) => {
        // 装饰resolve
        resolve = ((resolve2) => (...args) => {
            isResolved = true
            resolve2(...args)
        })(resolve)

        const retryUnlimited = async () => {
            // 外部终止retry
            const isBreak = stop(lastRequestRes)
            if (isBreak) {
                resolve([{ message: 'retry be terminal' }, null])
                return
            }

            // todo:抽离这部分逻辑
            await rRequest(lastRequestRes, () => {

            })
            // 发起请求
            const requestP = request(lastRequestRes)

            // 处理请求成功
            requestP.then(([requestErr, res]) => {
                if (!requestErr) {
                    resolve([null, res])
                }
            })

            // 计算下次轮询时机并等待
            await Promise.race([
                Promise.all([requestP, timeoutP(minRetryInterval(lastRequestRes))]),
                timeoutP(maxRetryInterval(lastRequestRes))
            ])

            if (!isResolved) {
                // 轮询
                retryUnlimited()
            }
        }
        retryUnlimited()
    })
}

// 正常轮询
export const makeNextUnlimited = (
    retry,
    stop,
    minInterval,
) => async function nextUnlimited(lastRequestRes = null) {
    const isBreak = stop(lastRequestRes)

    if (isBreak) {
        return
    }

    const retryP = retry(lastRequestRes)
    const minIntervalP = timeoutP(minInterval)

    const [err, curRequestRes] = await retryP
    if (err) {
        // retry被停止
        return
    }

    await minIntervalP
    nextUnlimited(curRequestRes)
}

const defaultMinIntervalTimeMS = 10000
const defaultMaxIntervalTimeMS = 30000

const defaultRetryMinIntervalTimeMS = 10000
const defaultRetryMaxIntervalTimeMS = 30000

const keepConnection = async (request, initRes, stop, {
    nextMinIntervalTimeMS = () => (defaultMinIntervalTimeMS),
    retryMinIntervalTimeMS = () => (defaultRetryMinIntervalTimeMS),
    retryMaxIntervalTimeMS = () => (defaultRetryMaxIntervalTimeMS),
}) => {
}

export default keepConnection
