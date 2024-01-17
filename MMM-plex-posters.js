const Notifications = {
  CONFIG: 'CONFIG',
  DATA: 'DATA',
  ERROR: 'ERROR',
};

const DisplayTypes = {
  MIXED: 'mixed',
  SEPARATE: 'separate',
};

// "dumb" function that just adds an 's'
// if interval is not 1 when floored.
// Simplify pluralizing time since etc. "month" "months"
const pluralizeInterval = (interval, word) => {
  const floored = Math.floor(interval);

  return `${floored} ${word}${floored !== 1 ? 's' : ''}`;
};

Module.register('MMM-plex-posters', {
  videos: [],

  defaults: {
    updateIntervalInMinute: 60,
    types: ['movie'],
    displayTimeAgo: false,
    displayType: DisplayTypes.MIXED,
    limit: 500,
    token: '',
    newerThanDay: 0,
    hostname: '127.0.0.1',
    port: '32400',
  },

  start: function () {
    Log.info(`Starting module: ${this.name}`);
    this.sendSocketNotification('CONFIG', this.config);
  },

  socketNotificationReceived: function (notification, payload) {
    Log.info(`${this.name}: socketNotificationReceived ${notification}`);
    Log.info("moors");

    this.sendSocketNotification('PRINT', notification);
    if (notification === Notifications.DATA) {
      this.sendSocketNotification('PRINT', "GABBA GOOL");
      this.videos = this.videos.concat(payload.items);
      
      this.updateDom();
    } else if (notification === Notifications.ERROR) {
      Log.info(`${this.name}:`, payload.error);
    }
  },

  getStyles: function () {
    return ['MMM-plex-posters.css'];
  },

  getDom() {
    if (this.videos.length > 0) {
        return this.getPosterDom();
    }

    return this.getMessageDom("Loading...");
  },

  getMessageDom(message) {
    const wrapper = document.createElement('div');
    wrapper.innerText = `${this.name}: ${message}`;

    return wrapper;
  },

  async getPosterDom() {
    var item = this.videos[Math.floor(Math.random()*this.videos.length)];
    
    // const itemDom = document.createElement('div');
    // itemDom.classList.add('item');

    const posterDom = document.createElement('div');
    posterDom.classList.add('poster');

    const thumbUrl = this.getThumbUrl(item);
    posterDom.style.backgroundImage = `url(${thumbUrl})`;
    posterDom.style.backgroundSize = 'cover';
    // itemDom.appendChild(posterDom);

    const metadataDom = this.getMetadataDom(item);
    if (metadataDom) {
      posterDom.appendChild(metadataDom);
    }

    return posterDom;
  },

  getThumbUrl(item) {
    let key = 'thumb';
    if (item.type === 'episode' || item.type === 'season') {
      key = 'parentThumb';
      if (item.grandparentThumb) {
        key = 'grandparentThumb';
      }
    }

    const url = new URL(
      `http://${this.config.hostname}:${this.config.port}${item[key]}`,
    );
    if (this.config.token) {
      url.searchParams.append('X-Plex-Token', this.config.token);
    }
    return url.href;
  },

  appendMetadataField(element, item, field) {
    let fieldValue = item[field];
    if (fieldValue) {
      if (field === 'addedAt') {
        fieldValue = `${this.timeSince(new Date(fieldValue * 1000))} ago`;
      }
      const div = document.createElement('div');
      div.classList.add(field);
      div.innerText = fieldValue;
      element.appendChild(div);
    }
  },

  timeSince(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;

    if (interval > 1) {
      return pluralizeInterval(interval, 'year');
    }
    interval = seconds / 2592000;
    if (interval > 1) {
      return pluralizeInterval(interval, 'month');
    }
    interval = seconds / 86400;
    if (interval > 1) {
      return pluralizeInterval(interval, 'day');
    }
    interval = seconds / 3600;
    if (interval > 1) {
      return pluralizeInterval(interval, 'hour');
    }
    interval = seconds / 60;
    if (interval > 1) {
      return pluralizeInterval(interval, 'minute');
    }
    return pluralizeInterval(interval, 'second');
  },

  getMetadataDom(item) {
    const type = item.type;

    const metadataDom = document.createElement('div');
    metadataDom.classList.add('metadata');
    metadataDom.classList.add(type);

    if (type === 'episode') {
      this.appendMetadataField(metadataDom, item, 'grandparentTitle');
      this.appendMetadataField(metadataDom, item, 'title');
      if (this.config.displayTimeAgo) {
        this.appendMetadataField(metadataDom, item, 'addedAt');
      }
      const SeasonEpisodeDom = document.createElement('div');
      SeasonEpisodeDom.classList.add('SeasonEpisode');
      SeasonEpisodeDom.innerText = `S${item.parentIndex}E${item.index}`;
      metadataDom.appendChild(SeasonEpisodeDom);
      return metadataDom;
    }

    if (type === 'season') {
      this.appendMetadataField(metadataDom, item, 'parentTitle');
      if (this.config.displayTimeAgo) {
        this.appendMetadataField(metadataDom, item, 'addedAt');
      }
      this.appendMetadataField(metadataDom, item, 'title');
      const SeasonEpisodeDom = document.createElement('div');
      SeasonEpisodeDom.classList.add('SeasonEpisode');
      SeasonEpisodeDom.innerText = `${item.leafCount} Episodes`;
      metadataDom.appendChild(SeasonEpisodeDom);

      return metadataDom;
    }

    this.appendMetadataField(metadataDom, item, 'title');
    if (this.config.displayTimeAgo) {
      this.appendMetadataField(metadataDom, item, 'addedAt');
    }
    this.appendMetadataField(metadataDom, item, 'year');

    return metadataDom;
  },

  getItemDom(item) {
    const itemDom = document.createElement('div');
    itemDom.classList.add('item');

    const posterDom = document.createElement('div');
    posterDom.classList.add('poster');

    const thumbUrl = this.getThumbUrl(item);
    posterDom.style.backgroundImage = `url(${thumbUrl})`;
    posterDom.style.backgroundSize = 'cover';
    itemDom.appendChild(posterDom);

    // const metadataDom = this.getMetadataDom(item);
    // if (metadataDom) {
    //   itemDom.appendChild(metadataDom);
    // }
    return itemDom;
  }
});
