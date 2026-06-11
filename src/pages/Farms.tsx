import React, { useEffect, useState } from 'react';
import { ShieldCheck, MapPin, Trees, Calendar, X, Image as ImageIcon, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

interface Farm {
  id: string;
  farm_name: string;
  farmer_name: string;
  phone: string;
  location: string;
  varieties: string;
  acres: number;
  since_year: number;
  story: string;
  photo_url: string;
  sort_order: number;
  active: boolean;
}

export const Farms: React.FC = () => {
  const { showToast } = useToast();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [farmerName, setFarmerName] = useState('');
  const [location, setLocation] = useState('');
  const [orchardSize, setOrchardSize] = useState('');
  const [farmingSince, setFarmingSince] = useState('');
  const [varietiesGrown, setVarietiesGrown] = useState('');
  const [story, setStory] = useState('');
  const [farmerPhoto, setFarmerPhoto] = useState<File | null>(null);
  const [farmerPhotoPreview, setFarmerPhotoPreview] = useState('');

  useEffect(() => {
    const fetchFarms = async () => {
      try {
        const { data, error } = await supabase
          .from('farms')
          .select('*')
          .eq('active', true)
          .order('sort_order', { ascending: true });

        if (error) throw error;
        setFarms(data || []);
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

    if (!location.trim()) {
      showToast('Please enter your orchard village/district.', 'error');
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
          location: location.trim(),
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
      setLocation('');
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
    <div className="container">
      <div className="farms-header">
        <h1>Our Partner Farms</h1>
        <p>
          We work closely with local family orchards in Chittoor district. By purchasing from us, you directly support their sustainable practices.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          🔄 Discovering orchards...
        </div>
      ) : farms.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          No partner farms listed at this moment.
        </div>
      ) : (
        <div>
          {farms.map((farm) => (
            <div key={farm.id} className="farm-card">
              <div className="farm-img-wrapper">
                <img
                  src={farm.photo_url || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=600'}
                  alt={farm.farm_name}
                  className="farm-img"
                />
              </div>

              <div className="farm-body">
                <div className="farm-title-row">
                  <h2>{farm.farm_name}</h2>
                  <span className="badge badge-approved" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                    <ShieldCheck size={12} /> Verified Partner
                  </span>
                </div>

                <div className="farm-meta">
                  <div className="farm-meta-item">
                    <strong>Farmer:</strong> {farm.farmer_name}
                  </div>
                  <div className="farm-meta-item">
                    <MapPin size={14} />
                    <span>{farm.location}</span>
                  </div>
                  {farm.acres && (
                    <div className="farm-meta-item">
                      <Trees size={14} />
                      <span>{farm.acres} Acres</span>
                    </div>
                  )}
                  {farm.since_year && (
                    <div className="farm-meta-item">
                      <Calendar size={14} />
                      <span>Farming since {farm.since_year}</span>
                    </div>
                  )}
                </div>

                <p className="farm-story">"{farm.story}"</p>

                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <strong>Varieties Grown:</strong> {farm.varieties}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Partnership application CTA */}
      <section className="farmer-join-cta">
        <h2>Are you a mango farmer?</h2>
        <p>
          We are always looking to partner with sustainable growers in Chittoor district. Skip the wholesale markets and get fair, transparent prices for your hard work.
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
                <label htmlFor="location">Farm Location (Village, Mandal, District) *</label>
                <input
                  type="text"
                  id="location"
                  className="form-control"
                  placeholder="e.g. Puthalapattu mandal, Chittoor"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="orchardSize">Orchard Size (acres)</label>
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
                <label htmlFor="varietiesGrown">Varieties Grown</label>
                <input
                  type="text"
                  id="varietiesGrown"
                  className="form-control"
                  placeholder="e.g. Banganapalli, Totapuri, Alphonso"
                  value={varietiesGrown}
                  onChange={(e) => setVarietiesGrown(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="story">Tell us your story *</label>
                <textarea
                  id="story"
                  className="form-control"
                  placeholder="Brief story about your orchard, farming techniques, organic methods..."
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
