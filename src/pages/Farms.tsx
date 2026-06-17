import React, { useEffect, useState } from 'react';
import { ShieldCheck, MapPin, Trees, Calendar, X, Image as ImageIcon, Upload, Images, Video, ExternalLink, Search, UserPlus, Megaphone, SlidersHorizontal } from 'lucide-react';
import { supabase } from '../lib/supabase';

const farmerImageFallback = '/CTRFLOGO.jpeg';
const useFarmerImageFallback = (event: React.SyntheticEvent<HTMLImageElement>) => {
  event.currentTarget.onerror = null;
  event.currentTarget.src = farmerImageFallback;
};
import { useToast } from '../context/ToastContext';

// All mandals in Chittoor district (alphabetical)
const CHITTOOR_MANDALS = [
  'B. Kothakota',
  'Baireddipalle',
  'Bangarupalem',
  'Buchinaidu Kandriga',
  'Chandragiri',
  'Chinnagottigallu',
  'Chittoor Rural',
  'Chittoor Urban',
  'Chowdepalle',
  'Doravari Chatram',
  'Gangadhara Nellore',
  'Gangavaram',
  'Gudipala',
  'Gudupalle',
  'Gudur',
  'Gurramkonda',
  'Irala',
  'Kalakada',
  'Kalikiri',
  'Kambhamvaripalle',
  'Karvetinagar',
  'Kuppam',
  'Kurabalakota',
  'Madanapalle',
  'Mulakalacheruvu',
  'Nagalapuram',
  'Nagari',
  'Naidupeta',
  'Narayanavanam',
  'Nimmanapalle',
  'Nindra',
  'Pakala',
  'Palamaner',
  'Palasamudram',
  'Peddamandyam',
  'Peddapanjani',
  'Peddathippasamudram',
  'Penumuru',
  'Pileru',
  'Pulicherla',
  'Punganur',
  'Puthalapattu',
  'Ramakuppam',
  'Ramasamudram',
  'Renigunta',
  'Rompicherla',
  'Sambepalle',
  'Santhipuram',
  'Sathyavedu',
  'Somala',
  'Srikalahasti',
  'Srirangarajapuram',
  'Thamballapalle',
  'Thavanampalle',
  'Tirupati Rural',
  'Tirupati Urban',
  'Vadamalapeta',
  'Valmikipuram',
  'Varadaiahpalem',
  'Vayalpadu',
  'Vedurukuppam',
  'Venkatagirikota',
  'Vijayapuram',
  'Yadamari',
  'Yerpedu',
  'Yerravaripalem',
];

interface Farm {
  id: string;
  farm_name: string;
  farmer_name: string;
  phone: string;
  location: string;
  farm_type: string | null;
  district: string | null;
  mandal: string | null;
  village: string | null;
  pincode: string | null;
  varieties: string;
  acres: number;
  since_year: number;
  story: string;
  photo_url: string;
  instagram_url: string | null;
  youtube_url: string | null;
  instagram_urls: string[];
  youtube_urls: string[];
  farm_update: string | null;
  feature_update_on_notice_board: boolean;
  sort_order: number;
  active: boolean;
}

// Helpers to get the effective arrays (fall back to legacy single columns)
const getInstagramUrls = (farm: Farm): string[] =>
  farm.instagram_urls?.length ? farm.instagram_urls : (farm.instagram_url ? [farm.instagram_url] : []);

const getYoutubeUrls = (farm: Farm): string[] =>
  farm.youtube_urls?.length ? farm.youtube_urls : (farm.youtube_url ? [farm.youtube_url] : []);

type FarmModal = { type: 'details' | 'instagram' | 'youtube'; farm: Farm } | null;

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

const getInstagramPermalink = (url: string) => {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('instagram.com')) return null;
    const match = parsed.pathname.match(/^\/(p|reel|tv)\/([^/]+)/);
    return match ? `https://www.instagram.com/${match[1]}/${match[2]}/` : null;
  } catch {
    return null;
  }
};

const getYouTubeEmbedUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    let videoId = '';
    if (parsed.hostname === 'youtu.be') videoId = parsed.pathname.slice(1).split('/')[0];
    if (parsed.hostname.includes('youtube.com')) {
      videoId = parsed.searchParams.get('v') || parsed.pathname.match(/^\/(shorts|embed)\/([^/]+)/)?.[2] || '';
    }
    return videoId ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` : null;
  } catch {
    return null;
  }
};

export const Farms: React.FC = () => {
  const { showToast } = useToast();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [farmModal, setFarmModal] = useState<FarmModal>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [farmSearch, setFarmSearch] = useState('');
  const [farmTypes, setFarmTypes] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [mandalFilter, setMandalFilter] = useState('');
  const [villageFilter, setVillageFilter] = useState('');

  useEffect(() => {
    const shouldLoadInstagram = farmModal?.type === 'instagram'
      || (farmModal?.type === 'details' && getInstagramUrls(farmModal.farm).length > 0);
    if (!shouldLoadInstagram) return;

    const processEmbed = () => window.instgrm?.Embeds.process();
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.instagram.com/embed.js"]');
    if (existingScript) {
      processEmbed();
      existingScript.addEventListener('load', processEmbed, { once: true });
      return () => existingScript.removeEventListener('load', processEmbed);
    }

    const script = document.createElement('script');
    script.src = 'https://www.instagram.com/embed.js';
    script.async = true;
    script.onload = processEmbed;
    document.body.appendChild(script);
  }, [farmModal]);

  // Form states
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [farmerName, setFarmerName] = useState('');
  const [farmType, setFarmType] = useState('');
  // 'Chittoor' | 'Other' | ''
  const [districtChoice, setDistrictChoice] = useState('');
  const [customDistrict, setCustomDistrict] = useState('');
  const [mandal, setMandal] = useState('');
  const [customMandal, setCustomMandal] = useState('');
  const [village, setVillage] = useState('');
  const [pincode, setPincode] = useState('');
  const [orchardSize, setOrchardSize] = useState('');
  const [farmingSince, setFarmingSince] = useState('');
  const [varietiesGrown, setVarietiesGrown] = useState('');
  const [story, setStory] = useState('');
  const [farmerPhoto, setFarmerPhoto] = useState<File | null>(null);
  const [farmerPhotoPreview, setFarmerPhotoPreview] = useState('');

  // Derived values used at submit time
  const resolvedDistrict = districtChoice === 'Other' ? customDistrict : districtChoice;
  const resolvedMandal = districtChoice === 'Other' ? customMandal : mandal;

  const handleDistrictChoiceChange = (value: string) => {
    setDistrictChoice(value);
    // Reset mandal selections when district type changes
    setMandal('');
    setCustomMandal('');
    setCustomDistrict('');
  };

  useEffect(() => {
    const fetchFarms = async () => {
      try {
        const [{ data, error }, { data: settings }] = await Promise.all([
          supabase.from('farms').select('*').eq('active', true).order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }),
          supabase.from('settings').select('farm_types').eq('id', 'main').single(),
        ]);

        if (error) throw error;
        setFarms(data || []);
        setFarmTypes(Array.isArray(settings?.farm_types) ? settings.farm_types : []);
      } catch (err) {
        console.error('Error fetching farms:', err);
        showToast('Failed to load partner farms.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchFarms();
  }, [showToast]);

  const handleOpenForm = () => {
    setIsApplyOpen(true);
  };

  const normalizedFarmSearch = farmSearch.trim().toLowerCase();
  const normalize = (value: string | null | undefined) => value?.trim().toLowerCase() || '';
  const filteredFarms = farms.filter((farm) => {
    const matchesSearch = !normalizedFarmSearch || [
      farm.farm_name,
      farm.farmer_name,
      farm.location,
      farm.farm_type,
      farm.district,
      farm.mandal,
      farm.village,
      farm.pincode,
      farm.varieties,
    ].join(' ').toLowerCase().includes(normalizedFarmSearch);
    const locationText = normalize(farm.location);
    return matchesSearch
      && (!typeFilter || normalize(farm.farm_type) === normalize(typeFilter))
      && (!districtFilter || (normalize(farm.district) || locationText).includes(normalize(districtFilter)))
      && (!mandalFilter || (normalize(farm.mandal) || locationText).includes(normalize(mandalFilter)))
      && (!villageFilter || (normalize(farm.village) || locationText).includes(normalize(villageFilter)));
  });
  const activeFilterCount = [typeFilter, districtFilter, mandalFilter, villageFilter].filter(Boolean).length;
  const clearFilters = () => {
    setTypeFilter('');
    setDistrictFilter('');
    setMandalFilter('');
    setVillageFilter('');
  };

  const handleCloseForm = () => {
    setIsApplyOpen(false);
  };

  const handleFarmerPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please choose a valid image file.', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Farmer photo must be smaller than 5 MB.', 'error');
      return;
    }

    setFarmerPhoto(file);
    setFarmerPhotoPreview(URL.createObjectURL(file));
  };

  const uploadFarmerPhoto = async (file: File) => {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `applications/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${fileExt}`;
    const { error } = await supabase.storage
      .from('chittoor-farms')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (error) throw error;
    return supabase.storage.from('chittoor-farms').getPublicUrl(fileName).data.publicUrl;
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();

    // Form validation
    if (!contactName.trim()) {
      showToast('Please enter your contact name.', 'error');
      return;
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number.', 'error');
      return;
    }

    if (!farmType || !resolvedDistrict.trim() || !resolvedMandal.trim() || !village.trim()) {
      showToast('Please select a farm type and complete the farm location.', 'error');
      return;
    }

    if (!/^\d{6}$/.test(pincode.trim())) {
      showToast('Please enter a valid 6-digit pincode.', 'error');
      return;
    }

    if (!story.trim()) {
      showToast('Please write a short story about your farm.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const photoUrl = farmerPhoto ? await uploadFarmerPhoto(farmerPhoto) : null;
      const { error } = await supabase.from('applications').insert([
        {
          contact_name: contactName.trim(),
          phone: phoneDigits,
          farmer_name: farmerName.trim() || null,
          location: [village, resolvedMandal, resolvedDistrict].map((item) => item.trim()).join(', '),
          farm_type: farmType,
          district: resolvedDistrict.trim(),
          mandal: resolvedMandal.trim(),
          village: village.trim(),
          pincode: pincode.trim(),
          orchard_size: orchardSize ? parseFloat(orchardSize) : null,
          farming_since: farmingSince ? parseInt(farmingSince) : null,
          varieties_grown: varietiesGrown.trim() || null,
          story: story.trim(),
          photo_url: photoUrl,
          status: 'new',
        },
      ]);

      if (error) throw error;

      showToast('Application submitted! We will contact you soon.', 'success');
      setIsApplyOpen(false);

      // Reset form
      setContactName('');
      setPhone('');
      setFarmerName('');
      setFarmType('');
      setDistrictChoice('');
      setCustomDistrict('');
      setMandal('');
      setCustomMandal('');
      setVillage('');
      setPincode('');
      setOrchardSize('');
      setFarmingSince('');
      setVarietiesGrown('');
      setStory('');
      setFarmerPhoto(null);
      setFarmerPhotoPreview('');
    } catch (err) {
      console.error('Error submitting application:', err);
      showToast('Submission failed. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container farms-page">
      <div className="farms-header">
        <h1>Meet our partner farmers</h1>
        <p>
          Meet verified local growers and producers bringing authentic farm-fresh goods closer to you.
        </p>
      </div>

      <div className="farms-directory-toolbar">
        <div className="farms-search-row">
          <div className="farms-search-box">
            <Search size={19} />
            <input
              type="search"
              value={farmSearch}
              onChange={(event) => setFarmSearch(event.target.value)}
              placeholder="Search farmer, farm, location, or produce..."
              aria-label="Search partner farms"
            />
            {farmSearch && <button type="button" onClick={() => setFarmSearch('')} aria-label="Clear farm search"><X size={16} /></button>}
          </div>
          <button type="button" className={`farms-filter-toggle ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters((value) => !value)} aria-expanded={showFilters} aria-label="Filter partner farms">
            <SlidersHorizontal size={19} />
            {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
          </button>
        </div>
        <span className="farms-result-count">{filteredFarms.length} farm{filteredFarms.length === 1 ? '' : 's'}</span>
        <button type="button" className="btn btn-secondary farms-join-button" onClick={handleOpenForm}><UserPlus size={18} /> Join Chittoor Farms</button>
      </div>

      {showFilters && (
        <div className="farms-advanced-filters">
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter by farm type">
            <option value="">All farm types</option>
            {farmTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <input value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)} placeholder="District" aria-label="Filter by district" />
          <input value={mandalFilter} onChange={(event) => setMandalFilter(event.target.value)} placeholder="Mandal" aria-label="Filter by mandal" />
          <input value={villageFilter} onChange={(event) => setVillageFilter(event.target.value)} placeholder="Village" aria-label="Filter by village" />
          <button type="button" onClick={clearFilters} disabled={activeFilterCount === 0}>Clear filters</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          🔄 Discovering orchards...
        </div>
      ) : farms.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          No partner farms listed at this moment.
        </div>
      ) : filteredFarms.length === 0 ? (
        <div className="farms-search-empty">
          <Search size={30} />
          <h3>No matching farms found</h3>
          <p>Try another farmer, location, farm type, or product.</p>
          <button type="button" className="btn btn-outline" onClick={() => { setFarmSearch(''); clearFilters(); }}>Clear Search & Filters</button>
        </div>
      ) : (
        <div className="farm-card-grid">
          {filteredFarms.map((farm) => (
            <article key={farm.id} className="farm-card">
              <div className="farm-card-top">
                <div className="farm-img-wrapper">
                  <img
                    src={farm.photo_url || farmerImageFallback}
                    alt={farm.farmer_name}
                    className="farm-img"
                    onError={useFarmerImageFallback}
                  />
                </div>
                <span className="farm-verified-mark" title="Verified Partner" aria-label="Verified Partner">
                  <ShieldCheck size={16} />
                </span>
              </div>

              <div className="farm-body">
                <p className="farm-card-name">
                  {farm.farm_name}
                  {farm.farm_type && <span className="farm-card-type"> ({farm.farm_type})</span>}
                </p>
                <h2>{farm.farmer_name}</h2>
                <p className="farm-card-location"><MapPin size={14} /> {farm.location}</p>

                <div className="farm-card-stat-row">
                  {farm.acres && <span><Trees size={14} /> {farm.acres} acres</span>}
                  {farm.since_year && <span><Calendar size={14} /> Since {farm.since_year}</span>}
                </div>

                <div className="farm-produce-list" aria-label={`Produce: ${farm.varieties}`}>
                  {farm.varieties.split(',').slice(0, 3).map((variety) => (
                    <span key={variety.trim()}>{variety.trim()}</span>
                  ))}
                  {farm.varieties.split(',').length > 3 && <span>+{farm.varieties.split(',').length - 3}</span>}
                </div>

                <div className="farm-card-actions">
                  <button type="button" className="btn btn-secondary farm-view-button" onClick={() => setFarmModal({ type: 'details', farm })}>View Farm</button>
                  <div className="farm-card-media-actions">
                    {farm.farm_update && (
                      <div className="farm-update-tooltip-wrapper">
                        <button type="button" className="farm-card-icon-button update-btn" aria-label="Farm update">
                          <Megaphone size={17} />
                        </button>
                        <div className="farm-update-tooltip">
                          <strong>Update</strong>
                          <p>{farm.farm_update}</p>
                        </div>
                      </div>
                    )}
                    {(() => {
                      const igUrls = getInstagramUrls(farm).filter((u) => getInstagramPermalink(u));
                      if (!igUrls.length) return null;
                      return (
                        <button type="button" className="farm-card-icon-button instagram" onClick={() => setFarmModal({ type: 'instagram', farm })} aria-label={`View ${farm.farmer_name} on Instagram`} title="Instagram">
                          <Images size={17} />
                          {igUrls.length > 1 && <span className="media-count-badge">{igUrls.length}</span>}
                        </button>
                      );
                    })()}
                    {(() => {
                      const ytUrls = getYoutubeUrls(farm).filter((u) => getYouTubeEmbedUrl(u));
                      if (!ytUrls.length) return null;
                      return (
                        <button type="button" className="farm-card-icon-button youtube" onClick={() => setFarmModal({ type: 'youtube', farm })} aria-label={`Watch ${farm.farmer_name} on YouTube`} title="YouTube">
                          <Video size={18} />
                          {ytUrls.length > 1 && <span className="media-count-badge">{ytUrls.length}</span>}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {farmModal && (
        <div className={`modal-backdrop open ${farmModal.type === 'details' ? 'farm-details-backdrop' : ''}`} onClick={() => setFarmModal(null)}>
          <div className={`modal-content farm-profile-modal farm-profile-modal-${farmModal.type}`} onClick={(event) => event.stopPropagation()}>
            {farmModal.type === 'details' ? (
              <button type="button" className="farm-profile-close" onClick={() => setFarmModal(null)} aria-label="Close farm profile"><X size={20} /></button>
            ) : (
              <div className="modal-header">
                <h3>{farmModal.type === 'instagram'
                  ? `${farmModal.farm.farmer_name} on Instagram${getInstagramUrls(farmModal.farm).length > 1 ? ` (${getInstagramUrls(farmModal.farm).length} posts)` : ''}`
                  : `${farmModal.farm.farmer_name} on YouTube${getYoutubeUrls(farmModal.farm).length > 1 ? ` (${getYoutubeUrls(farmModal.farm).length} videos)` : ''}`
                }</h3>
                <button type="button" className="btn-icon" onClick={() => setFarmModal(null)} aria-label="Close farm popup"><X size={20} /></button>
              </div>
            )}
            <div className="modal-body">
              {farmModal.type === 'details' && (
                <article className="farm-clean-profile">
                  <div className="farm-profile-hero">
                    <div className="farm-profile-portrait-wrap">
                      <div className="farm-profile-portrait">
                        <img src={farmModal.farm.photo_url || farmerImageFallback} alt={farmModal.farm.farmer_name} onError={useFarmerImageFallback} />
                      </div>
                      <span className="farm-profile-verified"><ShieldCheck size={15} /> Verified Chittoor Farms Partner</span>
                    </div>
                    <div className="farm-profile-intro">
                      <p className="farm-profile-farm-name">
                        {farmModal.farm.farm_name}
                        {farmModal.farm.farm_type && <span className="farm-card-type"> ({farmModal.farm.farm_type})</span>}
                      </p>
                      <h2>{farmModal.farm.farmer_name}</h2>
                      <p className="farm-profile-location"><MapPin size={18} /> {farmModal.farm.location}</p>

                      <div className="farm-profile-facts">
                        {farmModal.farm.acres && <div><Trees size={18} /><span><small>Farm</small><strong>{farmModal.farm.acres} acres</strong></span></div>}
                        {farmModal.farm.since_year && <div><Calendar size={18} /><span><small>Since</small><strong>{farmModal.farm.since_year}</strong></span></div>}
                        <div className="farm-profile-produce"><ImageIcon size={18} /><span><small>Produce</small><strong>{farmModal.farm.varieties}</strong></span></div>
                      </div>
                    </div>
                  </div>

                  <div className="farm-profile-story">
                    <div><span>Our Grower Story</span><h3>About the Farm</h3></div>
                    <p>{farmModal.farm.story}</p>
                  </div>

                  {farmModal.farm.farm_update && (
                    <section className="farm-profile-update">
                      <div className="farm-profile-update-icon"><Megaphone size={21} /></div>
                      <div>
                        <span>Updates from Farm</span>
                        <h3>Latest from {farmModal.farm.farm_name}</h3>
                        <p>{farmModal.farm.farm_update}</p>
                      </div>
                    </section>
                  )}

                  {(() => {
                    const ytUrls = getYoutubeUrls(farmModal.farm).filter((u) => getYouTubeEmbedUrl(u));
                    const igUrls = getInstagramUrls(farmModal.farm).filter((u) => getInstagramPermalink(u));
                    if (!ytUrls.length && !igUrls.length) return null;
                    return (
                      <section className="farm-profile-media">
                        <div className="farm-profile-section-heading">
                          <span>From the Farm</span>
                          <h3>Videos and Social Updates</h3>
                        </div>
                        <div className="farm-profile-media-grid">
                          {ytUrls.map((url, idx) => (
                            <div key={`yt-${idx}`} className="farm-profile-media-card">
                              <div className="farm-profile-media-label"><Video size={18} /> YouTube</div>
                              <div className="farm-video-frame"><iframe src={getYouTubeEmbedUrl(url) || ''} title={`${farmModal.farm.farmer_name} YouTube video ${idx + 1}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>
                            </div>
                          ))}
                          {igUrls.map((url, idx) => (
                            <div key={`ig-${idx}`} className="farm-profile-media-card">
                              <div className="farm-profile-media-label instagram"><Images size={18} /> Instagram</div>
                              <div className="farm-instagram-wrapper farm-instagram-inline">
                                <blockquote className="instagram-media" data-instgrm-permalink={getInstagramPermalink(url) || url} data-instgrm-version="14">
                                  <a href={url} target="_blank" rel="noreferrer">View this farm post on Instagram</a>
                                </blockquote>
                                <a className="btn btn-outline farm-instagram-fallback" href={url} target="_blank" rel="noreferrer"><ExternalLink size={16} /> View on Instagram</a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  })()}
                </article>
              )}
              {farmModal.type === 'instagram' && (() => {
                const igUrls = getInstagramUrls(farmModal.farm).filter((u) => getInstagramPermalink(u));
                return igUrls.map((url, idx) => (
                  <div key={idx} className="farm-instagram-wrapper" style={idx > 0 ? { marginTop: '1.5rem' } : undefined}>
                    {igUrls.length > 1 && <div className="farm-profile-media-label instagram" style={{ marginBottom: '0.5rem' }}><Images size={16} /> Instagram</div>}
                    <blockquote className="instagram-media" data-instgrm-permalink={getInstagramPermalink(url) || url} data-instgrm-version="14">
                      <a href={url} target="_blank" rel="noreferrer">View this farm post on Instagram</a>
                    </blockquote>
                    <a className="btn btn-outline farm-instagram-fallback" href={url} target="_blank" rel="noreferrer"><ExternalLink size={16} /> View on Instagram</a>
                  </div>
                ));
              })()}
              {farmModal.type === 'youtube' && (() => {
                const ytUrls = getYoutubeUrls(farmModal.farm).filter((u) => getYouTubeEmbedUrl(u));
                return ytUrls.map((url, idx) => (
                  <div key={idx} style={idx > 0 ? { marginTop: '1.5rem' } : undefined}>
                    {ytUrls.length > 1 && <div className="farm-profile-media-label" style={{ marginBottom: '0.5rem' }}><Video size={16} /> YouTube</div>}
                    <div className="farm-video-frame"><iframe src={getYouTubeEmbedUrl(url) || ''} title={`${farmModal.farm.farmer_name} YouTube video ${idx + 1}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Partnership application CTA */}
      <section className="farmer-join-cta">
        <h2>Are you a farmer or local producer?</h2>
        <p>
          Join Chittoor Farms to reach customers directly and receive fair, transparent value for what you grow or produce.
        </p>
        <button className="btn btn-secondary" onClick={handleOpenForm}>
          Apply to join →
        </button>
      </section>

      {/* Application Form Modal */}
      <div className={`modal-backdrop ${isApplyOpen ? 'open' : ''}`} onClick={handleCloseForm}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Farmer Partnership Form</h3>
            <button className="btn-icon" onClick={handleCloseForm} aria-label="Close form">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmitApplication}>
            <div className="modal-body">
              <div className="form-group">
                <label>Farmer Photo</label>
                <label htmlFor="farmerPhoto" className="application-photo-upload">
                  {farmerPhotoPreview ? (
                    <img src={farmerPhotoPreview} alt="Farmer preview" />
                  ) : (
                    <span>
                      <ImageIcon size={28} />
                      Upload a clear farmer picture
                    </span>
                  )}
                  <span className="application-photo-action"><Upload size={15} /> Choose Photo</span>
                </label>
                <input
                  id="farmerPhoto"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFarmerPhotoChange}
                  style={{ display: 'none' }}
                />
                <small className="form-help">JPG, PNG or WebP, up to 5 MB. This can be used on the Our Farms profile after approval.</small>
              </div>

              <div className="form-group">
                <label htmlFor="contactName">Your Name *</label>
                <input
                  type="text"
                  id="contactName"
                  className="form-control"
                  placeholder="Contact person's name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number (10-digit mobile) *</label>
                <input
                  type="tel"
                  id="phone"
                  className="form-control"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="farmerName">Farmer's Name (if different)</label>
                <input
                  type="text"
                  id="farmerName"
                  className="form-control"
                  placeholder="Owner's name"
                  value={farmerName}
                  onChange={(e) => setFarmerName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="applicationFarmType">Type of Farm *</label>
                <select id="applicationFarmType" className="form-control" value={farmType} onChange={(e) => setFarmType(e.target.value)} required>
                  <option value="">Select farm type</option>
                  {farmTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>

              {/* District — dropdown: Chittoor or Other */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="districtChoice">District *</label>
                  <select
                    id="districtChoice"
                    className="form-control"
                    value={districtChoice}
                    onChange={(e) => handleDistrictChoiceChange(e.target.value)}
                    required
                  >
                    <option value="">Select district</option>
                    <option value="Chittoor">Chittoor</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Mandal — dropdown when Chittoor, text when Other */}
                <div className="form-group">
                  <label htmlFor="mandal">Mandal *</label>
                  {districtChoice === 'Chittoor' ? (
                    <select
                      id="mandal"
                      className="form-control"
                      value={mandal}
                      onChange={(e) => setMandal(e.target.value)}
                      required
                    >
                      <option value="">Select mandal</option>
                      {CHITTOOR_MANDALS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="mandal"
                      className="form-control"
                      value={customMandal}
                      onChange={(e) => setCustomMandal(e.target.value)}
                      placeholder="Enter mandal name"
                      required={districtChoice === 'Other'}
                      disabled={!districtChoice}
                    />
                  )}
                </div>
              </div>

              {/* Free-text district name when Other is selected */}
              {districtChoice === 'Other' && (
                <div className="form-group">
                  <label htmlFor="customDistrict">District Name *</label>
                  <input
                    id="customDistrict"
                    className="form-control"
                    value={customDistrict}
                    onChange={(e) => setCustomDistrict(e.target.value)}
                    placeholder="Enter your district name"
                    required
                  />
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="village">Village *</label>
                  <input id="village" className="form-control" value={village} onChange={(e) => setVillage(e.target.value)} placeholder="Village name" required />
                </div>
                <div className="form-group">
                  <label htmlFor="pincode">Pincode *</label>
                  <input id="pincode" className="form-control" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" pattern="[0-9]{6}" placeholder="6-digit pincode" required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="orchardSize">Farm Size (acres)</label>
                  <input
                    type="number"
                    step="0.1"
                    id="orchardSize"
                    className="form-control"
                    placeholder="e.g. 5.5"
                    value={orchardSize}
                    onChange={(e) => setOrchardSize(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="farmingSince">Farming Since (Year)</label>
                  <input
                    type="number"
                    id="farmingSince"
                    className="form-control"
                    placeholder="e.g. 1998"
                    value={farmingSince}
                    onChange={(e) => setFarmingSince(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="varietiesGrown">Produce, Breeds or Varieties</label>
                <input
                  type="text"
                  id="varietiesGrown"
                  className="form-control"
                  placeholder="e.g. Mangoes, Sona Masoori rice, dairy milk"
                  value={varietiesGrown}
                  onChange={(e) => setVarietiesGrown(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="story">Tell us your story *</label>
                <textarea
                  id="story"
                  className="form-control"
                  placeholder="Brief story about your farm, methods, produce and values..."
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  rows={4}
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={handleCloseForm} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-secondary" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
