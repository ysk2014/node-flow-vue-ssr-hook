import Vue from 'vue'
import root from '@/app'

if (!root.data || typeof root.data != "function") {
  throw new Error("The app.js file must have a data method, and the data must be a function");
}

// a global mixin that calls `asyncData` when a route component's params change

Vue.mixin({
  beforeRouteUpdate (to, from, next) {
    const {asyncData} = this.$options;
    if (asyncData) {
      asyncData({
        store: this.$store,
        route: to
      }).then(next).catch(next)
    } else {
      next()
    }
  },

  beforeMount () {
    if(this.$store.state.SSR_FETCHED) {
      return
    }

    const {asyncData} = this.$options
    if (asyncData) {
      if (root.methods && typeof root.methods.asyncDataBefore === "function") {
        root.methods.asyncDataBefore();
      }
      asyncData({
        store: this.$store,
        route: this.$route
      }).then(() => {
        if (root.methods && typeof root.methods.asyncDataComplete === "function") {
          root.methods.asyncDataComplete();
        }
      })
    }
  },

  mounted() {
    this.$store.state.SSR_FETCHED = false
  }
})

const { app, router, store } = root.data(true)

// prime the store with server-initialized state.
// the state is determined during SSR and inlined in the page markup.
if (window.__INITIAL_STATE__) {
  store.replaceState(window.__INITIAL_STATE__)
}

// wait until router has resolved all async before hooks
// and async components...
router.onReady(() => {
  // actually mount to DOM
  app.$mount(root.el || "#app")
})
